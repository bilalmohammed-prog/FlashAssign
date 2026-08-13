/// <reference types="node" />

import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_ROLES,
  can,
  getRolePermissions,
  hasPermission,
  isStatusOnlyTaskUpdate,
  type AppRole,
} from "../../lib/auth/permissions";

describe("RBAC permission matrix", () => {
  it("defines all five application roles", () => {
    deepEqual([...APP_ROLES], [
      "owner",
      "admin",
      "manager",
      "employee",
      "viewer",
    ]);
  });

  for (const role of APP_ROLES) {
    it(`has explicit permissions for ${role}`, () => {
      ok(getRolePermissions(role).length > 0);
    });
  }

  it("viewer cannot mutate data", () => {
    equal(can("viewer", "create", "project"), false);
    equal(can("viewer", "update", "task"), false);
    equal(can("viewer", "delete", "task"), false);
    equal(can("viewer", "manage_members", "organization"), false);
    equal(can("viewer", "create", "comment"), false);
  });

  it("employee can update only assigned task status via scoped permission", () => {
    equal(can("employee", "update", "task"), false);
    equal(hasPermission("employee", "task:update_assigned"), true);
    equal(isStatusOnlyTaskUpdate({ status: "done" }), true);
    equal(isStatusOnlyTaskUpdate({ status: "done", title: "x" }), false);
  });

  it("manager cannot manage members", () => {
    equal(can("manager", "manage_members", "organization"), false);
    equal(can("manager", "create", "project"), true);
    equal(can("manager", "update", "project"), true);
    equal(can("manager", "delete", "task"), true);
  });

  it("admin can manage members and mutate work", () => {
    equal(can("admin", "manage_members", "organization"), true);
    equal(can("admin", "update", "task"), true);
    equal(can("admin", "update", "project"), true);
  });

  it("owner has full task and member permissions", () => {
    equal(can("owner", "manage_members", "organization"), true);
    equal(can("owner", "delete", "project"), true);
    equal(can("owner", "assign", "task"), true);
  });
});

describe("role-specific permission boundaries", () => {
  const cases: Array<{ role: AppRole; permission: string; allowed: boolean }> = [
    { role: "viewer", permission: "task:read", allowed: true },
    { role: "viewer", permission: "task:create", allowed: false },
    { role: "employee", permission: "task:create", allowed: false },
    { role: "employee", permission: "task:update_assigned", allowed: true },
    { role: "manager", permission: "organization:manage_members", allowed: false },
    { role: "admin", permission: "organization:manage_members", allowed: true },
  ];

  for (const { role, permission, allowed } of cases) {
    it(`${role} ${allowed ? "has" : "lacks"} ${permission}`, () => {
      equal(
        hasPermission(role, permission as Parameters<typeof hasPermission>[1]),
        allowed
      );
    });
  }
});
