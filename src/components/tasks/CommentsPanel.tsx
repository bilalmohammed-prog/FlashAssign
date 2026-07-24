"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
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
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CommentsPanel({
  taskId,
  orgId,
  currentUserId,
  canManageAll,
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
     <div className="flex h-full flex-col">
        
        <div className="flex h-full flex-col rounded-md border border-zinc-200 bg-white p-3">

        <h3 className="mb-2 text-[13px] font-medium text-zinc-500">
            Comments
        </h3>

          {loading ? (
            <div className="mb-3 flex items-center gap-2 px-1 py-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading comments
            </div>
          ) : comments.length === 0 ? (
            <div className="mb-3 px-1 py-2 text-xs text-zinc-400">No comments yet</div>
          ) : (
            <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {comments.map((comment) => {
                const canManageComment =
                  canManageAll || comment.user_id === currentUserId;
                const isEditing = editingId === comment.id;
                const isPending = pendingIds.has(comment.id);

                return (
                  <div key={comment.id} className="flex gap-2">
                    
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                      {getInitial(comment)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-zinc-800">
                            {getAuthorName(comment)}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {formatTimestamp(comment.updated_at)}
                          </div>
                        </div>
                        {canManageComment ? (
                          <div className="flex shrink-0 items-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void commitEdit(comment)}
                                  disabled={!editDraft.trim() || isPending}
                                  className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label="Save comment"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
                                  aria-label="Cancel edit"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => beginEdit(comment)}
                                  disabled={isPending}
                                  className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label="Edit comment"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(comment)}
                                  disabled={isPending}
                                  className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label="Delete comment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <div className="rounded-md border border-zinc-200 bg-white p-0.5 transition-[box-shadow,border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500">
                          <textarea
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                            rows={2}
                            maxLength={4000}
                            className="w-full resize-none rounded-[5px] border border-transparent bg-transparent px-2.5 py-2 text-sm text-zinc-700 outline-none"
                          />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-auto rounded-md border border-zinc-200 bg-white p-0.5 transition-[box-shadow,border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-indigo-500">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposeKeyDown}
              rows={2}
              maxLength={4000}
              placeholder="Add a comment"
              className="w-full resize-none rounded-[5px] border border-transparent bg-transparent px-2.5 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 outline-none"
            />
            <div className="flex justify-end px-1 pb-1">
              <button
                type="button"
                onClick={() => void handlePost()}
                disabled={!trimmedDraft || submitting}
                className="inline-flex min-h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                {submitting ? "Posting" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
