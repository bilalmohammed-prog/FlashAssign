"use client";

import type { TablesUpdate } from "@/lib/types/database";
import { CommentsPanel } from "@/components/tasks/CommentsPanel";
import { DescriptionEditor } from "@/components/tasks/DescriptionEditor";

type TaskDetailsPanelsProps = {
  taskId: string;
  orgId: string;
  currentUserId: string | null;
  descriptionValue: string;
  persistedDescription: string | null;
  canEditDescription: boolean;
  canManageComments: boolean;
  onDescriptionChange: (nextValue: string) => void;
  onCommitUpdate: (taskId: string, updates: TablesUpdate<"tasks">) => void;
};

export function TaskDetailsPanels({
  taskId,
  orgId,
  currentUserId,
  descriptionValue,
  persistedDescription,
  canEditDescription,
  canManageComments,
  onDescriptionChange,
  onCommitUpdate,
}: TaskDetailsPanelsProps) {
  return (
    <div className="expanded-panel border-t border-zinc-100 px-4 py-4 md:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
        <div className="h-[420px]">
          <DescriptionEditor
            value={descriptionValue}
            onChange={onDescriptionChange}
            onCommit={(value) =>
              value !== (persistedDescription ?? "") &&
              onCommitUpdate(taskId, { description: value.trim() ? value : null })
            }
            disabled={!canEditDescription}
          />
        </div>
        <div className="h-[420px]">
          <CommentsPanel
            taskId={taskId}
            orgId={orgId}
            currentUserId={currentUserId}
            canManageAll={canManageComments}
          />
        </div>
      </div>
    </div>
  );
}
