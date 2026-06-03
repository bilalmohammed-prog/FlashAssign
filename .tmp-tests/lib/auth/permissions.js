"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_ROLES = void 0;
exports.isAppRole = isAppRole;
exports.toAppRole = toAppRole;
exports.toPermission = toPermission;
exports.getRolePermissions = getRolePermissions;
exports.hasPermission = hasPermission;
exports.can = can;
exports.isStatusOnlyTaskUpdate = isStatusOnlyTaskUpdate;
exports.APP_ROLES = [
    "owner",
    "admin",
    "manager",
    "employee",
    "viewer",
];
const ROLE_PERMISSION_MATRIX = {
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
const VALID_PERMISSIONS = new Set([
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
function isAppRole(role) {
    return exports.APP_ROLES.includes(role);
}
function toAppRole(role) {
    if (isAppRole(role)) {
        return role;
    }
    throw new Error(`Invalid application role: ${role}`);
}
function toPermission(action, resource) {
    const permission = `${resource}:${action}`;
    if (!VALID_PERMISSIONS.has(permission)) {
        return null;
    }
    return permission;
}
function getRolePermissions(role) {
    return ROLE_PERMISSION_MATRIX[toAppRole(role)];
}
function hasPermission(role, permission) {
    return getRolePermissions(role).includes(permission);
}
function can(role, action, resource) {
    const permission = toPermission(action, resource);
    if (!permission) {
        return false;
    }
    return hasPermission(role, permission);
}
function isStatusOnlyTaskUpdate(updates) {
    const keys = Object.entries(updates).filter(([, value]) => value !== undefined);
    return keys.length > 0 && keys.every(([key]) => key === "status");
}
