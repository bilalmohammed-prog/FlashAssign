"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantIsolationFixture = createTenantIsolationFixture;
exports.cleanupTenantIsolationFixture = cleanupTenantIsolationFixture;
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });
const assert = __importStar(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const supabase_js_1 = require("@supabase/supabase-js");
const createdUsers = [];
const createdOrgIds = [];
function getRequiredEnv(name) {
    const value = process.env[name];
    assert.ok(value, `Missing required env var: ${name}`);
    return value;
}
function buildAnonClient() {
    return (0, supabase_js_1.createClient)(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}
function buildAdminClient() {
    return (0, supabase_js_1.createClient)(process.env.SUPABASE_URL ?? getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}
async function createUserIdentity(admin, emailPrefix) {
    const email = `${emailPrefix}-${(0, node_crypto_1.randomUUID)()}@example.test`;
    const password = `P@ssw0rd-${(0, node_crypto_1.randomUUID)()}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });
    assert.ifError(createError);
    assert.ok(created.user, "Failed to create auth user");
    createdUsers.push(created.user.id);
    const client = buildAnonClient();
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
    });
    assert.ifError(signInError);
    assert.ok(signInData.user, "Failed to sign in test user");
    return { user: signInData.user, client, password };
}
async function createTenantIsolationFixture() {
    const admin = buildAdminClient();
    const [userAOwner, userAMember, userBOwner] = await Promise.all([
        createUserIdentity(admin, "org-a-owner"),
        createUserIdentity(admin, "org-a-member"),
        createUserIdentity(admin, "org-b-owner"),
    ]);
    const [orgAResult, orgBResult] = await Promise.all([
        admin
            .from("organizations")
            .insert({ name: `Org A ${(0, node_crypto_1.randomUUID)()}`, slug: `org-a-${(0, node_crypto_1.randomUUID)().slice(0, 8)}` })
            .select("*")
            .single(),
        admin
            .from("organizations")
            .insert({ name: `Org B ${(0, node_crypto_1.randomUUID)()}`, slug: `org-b-${(0, node_crypto_1.randomUUID)().slice(0, 8)}` })
            .select("*")
            .single(),
    ]);
    assert.ifError(orgAResult.error);
    assert.ifError(orgBResult.error);
    assert.ok(orgAResult.data && orgBResult.data, "Failed to create org fixtures");
    const orgA = orgAResult.data;
    const orgB = orgBResult.data;
    createdOrgIds.push(orgA.id, orgB.id);
    const profileRows = [
        { id: userAOwner.user.id, active_organization_id: orgA.id, full_name: "Org A Owner" },
        { id: userAMember.user.id, active_organization_id: orgA.id, full_name: "Org A Member" },
        { id: userBOwner.user.id, active_organization_id: orgB.id, full_name: "Org B Owner" },
    ];
    const { error: profileError } = await admin.from("profiles").upsert(profileRows, { onConflict: "id" });
    assert.ifError(profileError);
    const membershipRows = [
        { organization_id: orgA.id, user_id: userAOwner.user.id, role: "owner" },
        { organization_id: orgA.id, user_id: userAMember.user.id, role: "employee" },
        { organization_id: orgB.id, user_id: userAOwner.user.id, role: "employee" },
        { organization_id: orgB.id, user_id: userBOwner.user.id, role: "owner" },
    ];
    const { error: memberError } = await admin.from("org_members").insert(membershipRows);
    assert.ifError(memberError);
    const [projectAVisibleRes, projectAHiddenRes, projectBRes] = await Promise.all([
        admin
            .from("projects")
            .insert({ organization_id: orgA.id, name: "A Visible Project", status: "active" })
            .select("*")
            .single(),
        admin
            .from("projects")
            .insert({ organization_id: orgA.id, name: "A Hidden Project", status: "active" })
            .select("*")
            .single(),
        admin
            .from("projects")
            .insert({ organization_id: orgB.id, name: "B Project", status: "active" })
            .select("*")
            .single(),
    ]);
    assert.ifError(projectAVisibleRes.error);
    assert.ifError(projectAHiddenRes.error);
    assert.ifError(projectBRes.error);
    assert.ok(projectAVisibleRes.data && projectAHiddenRes.data && projectBRes.data);
    const projectAVisible = projectAVisibleRes.data;
    const projectAHidden = projectAHiddenRes.data;
    const projectB = projectBRes.data;
    const { error: projectMemberError } = await admin.from("project_members").insert([
        {
            organization_id: orgA.id,
            project_id: projectAVisible.id,
            user_id: userAMember.user.id,
            role: "member",
        },
    ]);
    assert.ifError(projectMemberError);
    const [taskAVisibleRes, taskAHiddenRes, taskBRes] = await Promise.all([
        admin
            .from("tasks")
            .insert({
            organization_id: orgA.id,
            project_id: projectAVisible.id,
            created_by: userAOwner.user.id,
            title: "Task A Visible",
            status: "todo",
        })
            .select("*")
            .single(),
        admin
            .from("tasks")
            .insert({
            organization_id: orgA.id,
            project_id: projectAHidden.id,
            created_by: userAOwner.user.id,
            title: "Task A Hidden",
            status: "todo",
        })
            .select("*")
            .single(),
        admin
            .from("tasks")
            .insert({
            organization_id: orgB.id,
            project_id: projectB.id,
            created_by: userBOwner.user.id,
            title: "Task B",
            status: "todo",
        })
            .select("*")
            .single(),
    ]);
    assert.ifError(taskAVisibleRes.error);
    assert.ifError(taskAHiddenRes.error);
    assert.ifError(taskBRes.error);
    assert.ok(taskAVisibleRes.data && taskAHiddenRes.data && taskBRes.data);
    const taskAVisible = taskAVisibleRes.data;
    const taskAHidden = taskAHiddenRes.data;
    const taskB = taskBRes.data;
    const [assignmentARes, assignmentBRes] = await Promise.all([
        admin
            .from("assignments")
            .insert({
            organization_id: orgA.id,
            task_id: taskAVisible.id,
            user_id: userAMember.user.id,
            allocated_hours: 3,
        })
            .select("*")
            .single(),
        admin
            .from("assignments")
            .insert({
            organization_id: orgB.id,
            task_id: taskB.id,
            user_id: userBOwner.user.id,
            allocated_hours: 5,
        })
            .select("*")
            .single(),
    ]);
    assert.ifError(assignmentARes.error);
    assert.ifError(assignmentBRes.error);
    assert.ok(assignmentARes.data && assignmentBRes.data);
    const messageBRes = await admin
        .from("messages")
        .insert({
        organization_id: orgB.id,
        sender_id: userBOwner.user.id,
        recipient_id: userAOwner.user.id,
        content: "Org B private message",
    })
        .select("*")
        .single();
    assert.ifError(messageBRes.error);
    assert.ok(messageBRes.data);
    return {
        admin,
        userAOwner: { user: userAOwner.user, client: userAOwner.client },
        userAMember: { user: userAMember.user, client: userAMember.client },
        userBOwner: { user: userBOwner.user, client: userBOwner.client },
        orgA,
        orgB,
        projectAVisible,
        projectAHidden,
        projectB,
        taskAVisible,
        taskAHidden,
        taskB,
        assignmentA: assignmentARes.data,
        assignmentB: assignmentBRes.data,
        messageB: messageBRes.data,
    };
}
async function cleanupTenantIsolationFixture() {
    const admin = buildAdminClient();
    for (const orgId of createdOrgIds) {
        await admin.from("manager_employees").delete().eq("organization_id", orgId);
        await admin.from("messages").delete().eq("organization_id", orgId);
        await admin.from("assignments").delete().eq("organization_id", orgId);
        await admin.from("comments").delete().eq("organization_id", orgId);
        await admin.from("tasks").delete().eq("organization_id", orgId);
        await admin.from("project_members").delete().eq("organization_id", orgId);
        await admin.from("projects").delete().eq("organization_id", orgId);
        await admin.from("org_members").delete().eq("organization_id", orgId);
        await admin.from("organizations").delete().eq("id", orgId);
    }
    for (const userId of createdUsers) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
    }
}
