import { can, hasPermission, type AppRole } from "./permissions";

export function getWorkspaceCapabilities(role: AppRole) {
  return {
    canManageProjects: can(role, "create", "project"),
    canManageTasks: can(role, "update", "task"),
    canCreateTasks: can(role, "create", "task"),
    canDeleteTasks: can(role, "delete", "task"),
    canAssignTasks: can(role, "assign", "task"),
    canManageMembers: can(role, "manage_members", "organization"),
    canUpdateAssignedTaskStatus: hasPermission(role, "task:update_assigned"),
  };
}

export function canEditTask(
  role: AppRole,
  params: { userId: string; assigneeId: string | null }
): boolean {
  const caps = getWorkspaceCapabilities(role);
  if (caps.canManageTasks) {
    return true;
  }
  return (
    caps.canUpdateAssignedTaskStatus &&
    params.assigneeId !== null &&
    params.assigneeId === params.userId
  );
}
