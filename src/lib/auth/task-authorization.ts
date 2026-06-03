import { ForbiddenError } from "@/lib/api/errors";
import {
  can,
  hasPermission,
  isStatusOnlyTaskUpdate,
  type AppRole,
  type TaskUpdateFields,
} from "./permissions";

export function authorizeTaskUpdate(
  role: AppRole,
  params: {
    userId: string;
    assigneeUserId: string | null;
    updates: TaskUpdateFields;
  }
): void {
  if (can(role, "update", "task")) {
    return;
  }

  if (
    hasPermission(role, "task:update_assigned") &&
    params.assigneeUserId === params.userId &&
    isStatusOnlyTaskUpdate(params.updates)
  ) {
    return;
  }

  throw new ForbiddenError({
    message: `Role '${role}' cannot update this task`,
  });
}
