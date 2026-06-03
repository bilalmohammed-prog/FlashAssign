import { ForbiddenError } from "@/lib/api/errors";
import type {
  AppRole,
  AuthorizationAction,
  AuthorizationResource,
  DatabaseRole,
} from "./permissions";
import { can, toAppRole } from "./permissions";

export type AuthorizationContext = {
  role: DatabaseRole | AppRole;
};

export function isAuthorized(
  action: AuthorizationAction,
  resource: AuthorizationResource,
  context: AuthorizationContext
): boolean {
  return can(context.role, action, resource);
}

export function authorize(
  action: AuthorizationAction,
  resource: AuthorizationResource,
  context: AuthorizationContext
): void {
  if (!isAuthorized(action, resource, context)) {
    const role = toAppRole(context.role);
    throw new ForbiddenError({
      message: `Role '${role}' cannot ${action} ${resource}`,
    });
  }
}
