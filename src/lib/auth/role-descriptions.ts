import type { AppRole } from "./permissions";

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Full access including ownership transfer and member administration.",
  admin: "Manage members and work; cannot transfer ownership or modify owners.",
  manager: "Manage projects, tasks, and assignments; cannot manage members.",
  employee: "View work and update status on tasks assigned to them.",
  viewer: "Read-only access to organization, projects, tasks, and team.",
};
