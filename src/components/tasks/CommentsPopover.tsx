import { CommentsPanel } from "./CommentsPanel";
import { useEffect, useRef, type RefObject } from "react";

type CommentsPopoverProps = {
  taskId: string;
  orgId: string;
  currentUserId: string | null;
  canManageAll: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
};

export function CommentsPopover({
  taskId,
  orgId,
  currentUserId,
  canManageAll,
  onClose,
  triggerRef,
}: CommentsPopoverProps) {

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !triggerRef?.current?.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handleClickOutside);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [onClose, triggerRef]);

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-6 z-50 h-[30rem] w-96 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/5 selection:bg-indigo-500/20 selection:text-indigo-900"
      onClick={(e) => e.stopPropagation()}
    >
      <CommentsPanel
        taskId={taskId}
        orgId={orgId}
        currentUserId={currentUserId}
        canManageAll={canManageAll}
        onClose={onClose}
      />
    </div>
  );
}