"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { createTaskComment } from "@/actions/task/comment/create";
import { deleteTaskComment } from "@/actions/task/comment/delete";
import { listTaskComments } from "@/actions/task/comment/list";
import { updateTaskComment } from "@/actions/task/comment/update";
import { useToast } from "@/components/providers/toast";
import { cn } from "@/lib/utils";
import type { CommentWithAuthor } from "@/services/task/comment.service";

type TaskCommentsProps = {
  taskId: string;
  orgId: string;
  currentUserId: string | null;
  canManageAll: boolean;
  onClose?: () => void;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function getAuthorName(comment: CommentWithAuthor): string {
  return comment.author?.full_name?.trim() || "Unknown user";
}

function getInitial(comment: CommentWithAuthor): string {
  return getAuthorName(comment).charAt(0).toUpperCase() || "?";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${datePart} at ${timePart}`;
}

// Deterministic avatar color per user — visual polish only, not a new feature.
const AVATAR_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
];

function getAvatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function CommentsPanel({
  taskId,
  orgId,
  currentUserId,
  canManageAll,
  onClose,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const { addToast } = useToast();

  const trimmedDraft = draft.trim();

  const setCommentPending = (commentId: string, isPending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (isPending) {
        next.add(commentId);
      } else {
        next.delete(commentId);
      }
      return next;
    });
  };

  const loadComments = async () => {
    setLoading(true);
    try {
      const nextComments = await listTaskComments(taskId, orgId);
      setComments(nextComments);
      setHasLoaded(true);
    } catch (error) {
      addToast(getErrorMessage(error) || "Failed to load comments", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoaded && !loading) {
      void loadComments();
    }
  }, []);

  const handlePost = async () => {
    if (!trimmedDraft || submitting) return;

    const now = new Date().toISOString();
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const previousComments = comments;
    const optimisticComment: CommentWithAuthor = {
      id: optimisticId,
      task_id: taskId,
      organization_id: orgId,
      user_id: currentUserId ?? "",
      content: trimmedDraft,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      author: currentUserId
        ? {
            id: currentUserId,
            full_name: "You",
          }
        : null,
    };

    setSubmitting(true);
    setDraft("");
    setComments((current) => [...current, optimisticComment]);

    try {
      const created = await createTaskComment(taskId, orgId, trimmedDraft);
      setComments((current) =>
        current.map((comment) =>
          comment.id === optimisticId
            ? {
                ...created,
                author: optimisticComment.author,
              }
            : comment
        )
      );
    } catch (error) {
      setComments(previousComments);
      setDraft(trimmedDraft);
      addToast(getErrorMessage(error) || "Failed to post comment", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const beginEdit = (comment: CommentWithAuthor) => {
    setEditingId(comment.id);
    setEditDraft(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const commitEdit = async (comment: CommentWithAuthor) => {
    const nextContent = editDraft.trim();
    if (!nextContent || nextContent === comment.content || pendingIds.has(comment.id)) {
      cancelEdit();
      return;
    }

    const previousComments = comments;
    setCommentPending(comment.id, true);
    setEditingId(null);
    setEditDraft("");
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? { ...item, content: nextContent, updated_at: new Date().toISOString() }
          : item
      )
    );

    try {
      const updated = await updateTaskComment(taskId, comment.id, orgId, nextContent);
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id ? { ...updated, author: item.author } : item
        )
      );
    } catch (error) {
      setComments(previousComments);
      addToast(getErrorMessage(error) || "Failed to update comment", "error");
    } finally {
      setCommentPending(comment.id, false);
    }
  };

  const handleDelete = async (comment: CommentWithAuthor) => {
    if (pendingIds.has(comment.id)) return;

    const previousComments = comments;
    setCommentPending(comment.id, true);
    setComments((current) => current.filter((item) => item.id !== comment.id));

    try {
      await deleteTaskComment(taskId, comment.id, orgId);
    } catch (error) {
      setComments(previousComments);
      addToast(getErrorMessage(error) || "Failed to delete comment", "error");
    } finally {
      setCommentPending(comment.id, false);
    }
  };

  const handleComposeKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handlePost();
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-zinc-800">
          Comments
          {comments.length > 0 && (
            <span className="ml-1.5 font-normal text-zinc-400">
              {comments.length}
            </span>
          )}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading comments
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-50">
            <MessageSquare className="h-4 w-4 text-zinc-300" />
          </div>
          <p className="text-xs text-zinc-400">No comments yet</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {comments.map((comment) => {
            const canManageComment =
              canManageAll || comment.user_id === currentUserId;
            const isEditing = editingId === comment.id;
            const isPending = pendingIds.has(comment.id);
            const avatarColor = getAvatarColor(comment.user_id || comment.id);

            return (
              <div
                key={comment.id}
                className={cn(
                  "group relative rounded-lg border border-zinc-100 bg-white p-2.5 transition-colors",
                  isEditing ? "border-2 border-indigo-400" : "hover:border-zinc-200 hover:bg-zinc-50/60"
                )}
              >
                <div className="flex gap-2.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      avatarColor.bg,
                      avatarColor.text
                    )}
                  >
                    {getInitial(comment)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate text-xs font-semibold text-zinc-800">
                        {getAuthorName(comment)}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-400">
                        {formatTimestamp(comment.updated_at)}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="rounded-md border border-indigo-600 bg-white">
                          <textarea
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                            rows={2}
                            maxLength={4000}
                            autoFocus
                            className="w-full resize-none rounded-md bg-transparent px-2.5 py-2 text-sm text-zinc-700 outline-none"
                          />
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void commitEdit(comment)}
                            disabled={!editDraft.trim() || isPending}
                            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                          >
                            {isPending ? "Saving" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-600">
                        {comment.content}
                      </p>
                    )}
                  </div>
                </div>

                {canManageComment && !isEditing && (
                  <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => beginEdit(comment)}
                      disabled={isPending}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Edit comment"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(comment)}
                      disabled={isPending}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-zinc-100 p-3">
        <div className="rounded-lg border border-zinc-200 bg-white transition-[border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposeKeyDown}
            rows={2}
            maxLength={4000}
            placeholder="Add a comment"
            className="w-full resize-none rounded-t-lg bg-transparent px-3 py-2.5 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none"
          />
          <div className="flex items-center justify-between border-t border-zinc-100 px-2 py-1.5">
            <span className="px-1 text-[11px] text-zinc-300">⌘⏎ to send</span>
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={!trimmedDraft || submitting}
              className="inline-flex min-h-7 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              {submitting ? "Posting" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}