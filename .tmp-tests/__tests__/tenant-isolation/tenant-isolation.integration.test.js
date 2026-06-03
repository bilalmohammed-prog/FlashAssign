"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_test_1 = require("node:test");
const fixtures_1 = require("./fixtures");
(0, node_test_1.describe)("tenant isolation integration", () => {
    let fixture;
    let devServer;
    const baseUrl = "http://127.0.0.1:4010";
    (0, node_test_1.before)(async () => {
        const nextBin = node_path_1.default.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
        devServer = (0, node_child_process_1.spawn)(process.execPath, [nextBin, "dev", "--port", "4010"], {
            cwd: process.cwd(),
            stdio: "ignore",
            shell: false,
        });
        const start = Date.now();
        while (Date.now() - start < 90000) {
            try {
                await fetch(`${baseUrl}/api/projects`, { method: "GET" });
                break;
            }
            catch {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        fixture = await (0, fixtures_1.createTenantIsolationFixture)();
    });
    (0, node_test_1.after)(async () => {
        await (0, fixtures_1.cleanupTenantIsolationFixture)();
        if (devServer && !devServer.killed) {
            devServer.kill("SIGTERM");
        }
    });
    (0, node_test_1.test)("1) unauthenticated request to every API route returns 401", async () => {
        const routes = [
            { method: "GET", path: "/api/assignments" },
            { method: "POST", path: "/api/assignments", body: { task_id: fixture.taskAVisible.id, user_id: fixture.userAMember.user.id } },
            { method: "PATCH", path: `/api/assignments/${fixture.assignmentA.id}`, body: { allocated_hours: 2 } },
            { method: "DELETE", path: `/api/assignments/${fixture.assignmentA.id}` },
            { method: "GET", path: `/api/displayTasks?employee_id=${fixture.userAMember.user.id}` },
            { method: "GET", path: `/api/employee-overview?email=unauth@example.test` },
            { method: "GET", path: "/api/employee-switch" },
            { method: "POST", path: "/api/invites/accept", body: { manager_id: fixture.userAOwner.user.id } },
            { method: "POST", path: "/api/invites/decline", body: {} },
            { method: "DELETE", path: "/api/invites/drop", body: { employee_id: fixture.userAMember.user.id, manager_id: fixture.userAOwner.user.id } },
            { method: "GET", path: "/api/messages" },
            { method: "POST", path: "/api/messages/send", body: { content: "test", recipientId: fixture.userAOwner.user.id } },
            { method: "GET", path: "/api/projects" },
            { method: "POST", path: "/api/projects", body: { name: "Unauth Project" } },
            { method: "PATCH", path: `/api/projects/${fixture.projectAVisible.id}`, body: { name: "Update" } },
            { method: "DELETE", path: `/api/projects/${fixture.projectAVisible.id}` },
            { method: "GET", path: `/api/projects/${fixture.projectAVisible.id}/members` },
            { method: "POST", path: `/api/projects/${fixture.projectAVisible.id}/members`, body: { userId: fixture.userAMember.user.id } },
            { method: "PATCH", path: `/api/projects/${fixture.projectAVisible.id}/members/${fixture.userAMember.user.id}`, body: { role: "contributor" } },
            { method: "DELETE", path: `/api/projects/${fixture.projectAVisible.id}/members/${fixture.userAMember.user.id}` },
            { method: "POST", path: "/api/tasks", body: { title: "Task", user_id: fixture.userAMember.user.id, project_id: fixture.projectAVisible.id } },
            { method: "PATCH", path: `/api/tasks/${fixture.taskAVisible.id}`, body: { title: "Updated" } },
            { method: "DELETE", path: `/api/tasks/${fixture.taskAVisible.id}` },
            { method: "GET", path: `/api/tasks/${fixture.taskAVisible.id}/comments` },
            { method: "POST", path: `/api/tasks/${fixture.taskAVisible.id}/comments`, body: { content: "Hello" } },
            { method: "PATCH", path: `/api/tasks/${fixture.taskAVisible.id}/comments/${fixture.messageB.id}`, body: { content: "Edit" } },
            { method: "DELETE", path: `/api/tasks/${fixture.taskAVisible.id}/comments/${fixture.messageB.id}` },
            { method: "GET", path: "/api/teamProgress" },
        ];
        for (const route of routes) {
            const response = await fetch(`${baseUrl}${route.path}`, {
                method: route.method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: route.body ? JSON.stringify(route.body) : undefined,
            });
            strict_1.default.equal(response.status, 401, `Expected 401 for ${route.method} ${route.path}, got ${response.status}`);
        }
    });
    (0, node_test_1.test)("2) authenticated user from org A cannot read org B projects/tasks/assignments/messages", async () => {
        const actor = fixture.userAMember.client;
        const [projectsRes, tasksRes, assignmentsRes, messagesRes] = await Promise.all([
            actor.from("projects").select("id").eq("organization_id", fixture.orgB.id),
            actor.from("tasks").select("id").eq("organization_id", fixture.orgB.id),
            actor.from("assignments").select("id").eq("organization_id", fixture.orgB.id),
            actor.from("messages").select("id").eq("organization_id", fixture.orgB.id),
        ]);
        strict_1.default.ifError(projectsRes.error);
        strict_1.default.ifError(tasksRes.error);
        strict_1.default.ifError(assignmentsRes.error);
        strict_1.default.ifError(messagesRes.error);
        strict_1.default.equal(projectsRes.data?.length ?? 0, 0);
        strict_1.default.equal(tasksRes.data?.length ?? 0, 0);
        strict_1.default.equal(assignmentsRes.data?.length ?? 0, 0);
        strict_1.default.equal(messagesRes.data?.length ?? 0, 0);
    });
    (0, node_test_1.test)("3) employee role cannot perform admin actions", async () => {
        const { data: session } = await fixture.userAMember.client.auth.getSession();
        const token = session.session?.access_token;
        strict_1.default.ok(token, "Missing employee access token");
        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
        const [deleteProjectRes, removeOrgMemberRes, updateOtherTaskRes] = await Promise.all([
            fetch(`${baseUrl}/api/projects/${fixture.projectAVisible.id}`, {
                method: "DELETE",
                headers,
            }),
            fetch(`${baseUrl}/api/projects/${fixture.projectAVisible.id}/members/${fixture.userAOwner.user.id}`, { method: "DELETE", headers }),
            fetch(`${baseUrl}/api/tasks/${fixture.taskAHidden.id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ title: "Member edited owner task" }),
            }),
        ]);
        strict_1.default.equal(deleteProjectRes.status, 403, `Expected 403 for member delete project, got ${deleteProjectRes.status}`);
        strict_1.default.equal(removeOrgMemberRes.status, 403, `Expected 403 for member remove org member, got ${removeOrgMemberRes.status}`);
        strict_1.default.equal(updateOtherTaskRes.status, 403, `Expected 403 for member update other task, got ${updateOtherTaskRes.status}`);
    });
});
