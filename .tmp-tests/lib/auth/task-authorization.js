"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeTaskUpdate = authorizeTaskUpdate;
const errors_1 = require("@/lib/api/errors");
const permissions_1 = require("./permissions");
function authorizeTaskUpdate(role, params) {
    if ((0, permissions_1.can)(role, "update", "task")) {
        return;
    }
    if ((0, permissions_1.hasPermission)(role, "task:update_assigned") &&
        params.assigneeUserId === params.userId &&
        (0, permissions_1.isStatusOnlyTaskUpdate)(params.updates)) {
        return;
    }
    throw new errors_1.ForbiddenError({
        message: `Role '${role}' cannot update this task`,
    });
}
