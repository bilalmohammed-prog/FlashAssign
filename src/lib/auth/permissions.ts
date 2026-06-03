import type { Database } from "../types/database";

export type DatabaseRole = Database["public"]["Enums"]["role_type"];
export type AppRole = "owner" | "admin" | "manager" | "employee" | "viewer";

export const APP_ROLES: readonly AppRole[] = [
  "owner",
  "admin",
  "manager",
  "employee",
  "viewer",
] as const;

export type AuthorizationResource =
  | "organization"
  | "project"
  | "task"
  | "assignment"
  | "comment";

export type AuthorizationAction =
  | "read"
  | "manage_members"
  | "create"
  | "update"
  | "update_assigned"
  | "delete"
  | "assign";

export type Permission =
  | "organization:read"
  | "organization:manage_members"
  | "project:create"
  | "project:update"
  | "project:delete"
  | "task:read"
  | "task:create"
  | "task:update"
  | "task:update_assigned"
  | "task:delete"
  | "task:assign"
  | "assignment:read"
  | "assignment:update"
  | "comment:create"
  | "comment:update"
  | "comment:delete";

const ROLE_PERMISSION_MATRIX: Record<AppRole, readonly Permission[]> = {
  owner: [
    "organization:read",
    "organization:manage_members",
    "project:create",
    "project:update",
    "project:delete",
    "task:read",
    "task:create",
    "task:update",
    "task:delete",
    "task:assign",
    "assignment:read",
    "assignment:update",
    "comment:create",
    "comment:update",
    "comment:delete",
  ],
  admin: [
    "organization:read",
    "organization:manage_members",
    "project:create",
    "project:update",
    "project:delete",
    "task:read",
    "task:create",
    "task:update",
    "task:delete",
    "task:assign",
    "assignment:read",
    "assignment:update",
    "comment:create",
    "comment:update",
    "comment:delete",
  ],
  manager: [
    "organization:read",
    "project:create",
    "project:update",
    "project:delete",
    "task:read",
    "task:create",
    "task:update",
    "task:delete",
    "task:assign",
    "assignment:read",
    "assignment:update",
  ],
  employee: [
    "organization:read",
    "task:read",
    "task:update_assigned",
    "assignment:read",
  ],
  viewer: [
    "organization:read",
    "task:read",
    "assignment:read",
  ],
};

const VALID_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "organization:read",
  "organization:manage_members",
  "project:create",
  "project:update",
  "project:delete",
  "task:read",
  "task:create",
  "task:update",
  "task:update_assigned",
  "task:delete",
  "task:assign",
  "assignment:read",
  "assignment:update",
  "comment:create",
  "comment:update",
  "comment:delete",
]);

export function isAppRole(role: string): role is AppRole {
  return (APP_ROLES as readonly string[]).includes(role);
}

export function toAppRole(role: DatabaseRole | AppRole): AppRole {
  if (isAppRole(role)) {
    return role;
  }
  throw new Error(`Invalid application role: ${role}`);
}

export function toPermission(
  action: AuthorizationAction,
  resource: AuthorizationResource
): Permission | null {
  const permission = `${resource}:${action}` as Permission;
  if (!VALID_PERMISSIONS.has(permission)) {
    return null;
  }
  return permission;
}

export function getRolePermissions(role: DatabaseRole | AppRole): readonly Permission[] {
  return ROLE_PERMISSION_MATRIX[toAppRole(role)];
}

export function hasPermission(
  role: DatabaseRole | AppRole,
  permission: Permission
): boolean {
  return getRolePermissions(role).includes(permission);
}

export function can(
  role: DatabaseRole | AppRole,
  action: AuthorizationAction,
  resource: AuthorizationResource
): boolean {
  const permission = toPermission(action, resource);
  if (!permission) {
    return false;
  }
  return hasPermission(role, permission);
}

export type TaskUpdateFields = {
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
  status?: string | null;
  project_id?: string | null;
};

export function isStatusOnlyTaskUpdate(updates: TaskUpdateFields): boolean {
  const keys = Object.entries(updates).filter(([, value]) => value !== undefined);
  return keys.length > 0 && keys.every(([key]) => key === "status");
}
