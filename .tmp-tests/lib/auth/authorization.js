"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthorized = isAuthorized;
exports.authorize = authorize;
const errors_1 = require("@/lib/api/errors");
const permissions_1 = require("./permissions");
function isAuthorized(action, resource, context) {
    return (0, permissions_1.can)(context.role, action, resource);
}
function authorize(action, resource, context) {
    if (!isAuthorized(action, resource, context)) {
        const role = (0, permissions_1.toAppRole)(context.role);
        throw new errors_1.ForbiddenError({
            message: `Role '${role}' cannot ${action} ${resource}`,
        });
    }
}
