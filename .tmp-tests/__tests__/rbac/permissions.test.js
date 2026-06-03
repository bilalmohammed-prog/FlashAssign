"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const permissions_1 = require("../../lib/auth/permissions");
(0, node_test_1.describe)("RBAC permission matrix", () => {
    (0, node_test_1.it)("defines all five application roles", () => {
        strict_1.default.deepEqual([...permissions_1.APP_ROLES], [
            "owner",
            "admin",
            "manager",
            "employee",
            "viewer",
        ]);
    });
    for (const role of permissions_1.APP_ROLES) {
        (0, node_test_1.it)(`has explicit permissions for ${role}`, () => {
            strict_1.default.ok((0, permissions_1.getRolePermissions)(role).length > 0);
        });
    }
    (0, node_test_1.it)("viewer cannot mutate data", () => {
        strict_1.default.equal((0, permissions_1.can)("viewer", "create", "project"), false);
        strict_1.default.equal((0, permissions_1.can)("viewer", "update", "task"), false);
        strict_1.default.equal((0, permissions_1.can)("viewer", "delete", "task"), false);
        strict_1.default.equal((0, permissions_1.can)("viewer", "manage_members", "organization"), false);
        strict_1.default.equal((0, permissions_1.can)("viewer", "create", "comment"), false);
    });
    (0, node_test_1.it)("employee can update only assigned task status via scoped permission", () => {
        strict_1.default.equal((0, permissions_1.can)("employee", "update", "task"), false);
        strict_1.default.equal((0, permissions_1.hasPermission)("employee", "task:update_assigned"), true);
        strict_1.default.equal((0, permissions_1.isStatusOnlyTaskUpdate)({ status: "done" }), true);
        strict_1.default.equal((0, permissions_1.isStatusOnlyTaskUpdate)({ status: "done", title: "x" }), false);
    });
    (0, node_test_1.it)("manager cannot manage members", () => {
        strict_1.default.equal((0, permissions_1.can)("manager", "manage_members", "organization"), false);
        strict_1.default.equal((0, permissions_1.can)("manager", "create", "project"), true);
        strict_1.default.equal((0, permissions_1.can)("manager", "update", "project"), true);
        strict_1.default.equal((0, permissions_1.can)("manager", "delete", "task"), true);
    });
    (0, node_test_1.it)("admin can manage members and mutate work", () => {
        strict_1.default.equal((0, permissions_1.can)("admin", "manage_members", "organization"), true);
        strict_1.default.equal((0, permissions_1.can)("admin", "update", "task"), true);
        strict_1.default.equal((0, permissions_1.can)("admin", "update", "project"), true);
    });
    (0, node_test_1.it)("owner has full task and member permissions", () => {
        strict_1.default.equal((0, permissions_1.can)("owner", "manage_members", "organization"), true);
        strict_1.default.equal((0, permissions_1.can)("owner", "delete", "project"), true);
        strict_1.default.equal((0, permissions_1.can)("owner", "assign", "task"), true);
    });
});
(0, node_test_1.describe)("role-specific permission boundaries", () => {
    const cases = [
        { role: "viewer", permission: "task:read", allowed: true },
        { role: "viewer", permission: "task:create", allowed: false },
        { role: "employee", permission: "task:create", allowed: false },
        { role: "employee", permission: "task:update_assigned", allowed: true },
        { role: "manager", permission: "organization:manage_members", allowed: false },
        { role: "admin", permission: "organization:manage_members", allowed: true },
    ];
    for (const { role, permission, allowed } of cases) {
        (0, node_test_1.it)(`${role} ${allowed ? "has" : "lacks"} ${permission}`, () => {
            strict_1.default.equal((0, permissions_1.hasPermission)(role, permission), allowed);
        });
    }
});
