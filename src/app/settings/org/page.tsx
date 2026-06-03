import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/types/database";

type RoleType = Database["public"]["Enums"]["role_type"];

const roleOptions: RoleType[] = ["owner", "admin", "manager", "employee", "viewer"];

export default async function OrgSettingsPage() {
  console.time("[perf] [Page] org settings total");
  console.time("[perf] [Fetch] org settings requireOrgContext");
  const ctx = await requireOrgContext();
  console.timeEnd("[perf] [Fetch] org settings requireOrgContext");

  console.time("[perf] [Fetch] org settings member queries");
  const [membersResult, orgMembersResult] = await Promise.all([
    listOrgMembers(ctx.organizationId),
    ctx.supabase
      .from("org_members")
      .select("user_id,role")
      .eq("organization_id", ctx.organizationId),
  ]);
  console.timeEnd("[perf] [Fetch] org settings member queries");

  console.time("[perf] [Compute] org settings role map");
  const members = membersResult.data ?? [];
  const roleByUserId = new Map((orgMembersResult.data ?? []).map((row) => [row.user_id, row.role]));
  console.timeEnd("[perf] [Compute] org settings role map");
  console.timeEnd("[perf] [Page] org settings total");

  async function inviteMemberMutation(formData: FormData) {
    "use server";
    const orgCtx = await requireOrgContext();
    authorize("manage_members", "organization", { role: orgCtx.role });
    const userId = String(formData.get("userId") ?? "").trim();
    const role = String(formData.get("role") ?? "employee") as RoleType;
    if (!userId) return;

    await orgCtx.supabase.from("org_members").upsert(
      {
        organization_id: orgCtx.organizationId,
        user_id: userId,
        role,
      },
      {
        onConflict: "organization_id,user_id",
        ignoreDuplicates: false,
      }
    );
    revalidatePath("/settings/org");
  }

  async function updateRoleMutation(formData: FormData) {
    "use server";
    const orgCtx = await requireOrgContext();
    authorize("manage_members", "organization", { role: orgCtx.role });
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "employee") as RoleType;
    if (!userId) return;

    await orgCtx.supabase
      .from("org_members")
      .update({ role })
      .eq("organization_id", orgCtx.organizationId)
      .eq("user_id", userId);

    revalidatePath("/settings/org");
  }

  return (
    <div className="w-full max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">Manage org members, invites, and roles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Member</CardTitle>
          <CardDescription>Add an existing user to this organization by user ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteMemberMutation} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input name="userId" placeholder="User UUID" required className="md:col-span-2" />
            <select
              name="role"
              defaultValue="employee"
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <div className="md:col-span-3">
              <Button type="submit">Send Invite</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Org Members</CardTitle>
          <CardDescription>Review members and update roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            members.map((member) => (
              <form key={member.user_id} action={updateRoleMutation} className="grid grid-cols-1 items-center gap-3 rounded-md border border-border p-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.user_id}</p>
                </div>
                <input type="hidden" name="userId" value={member.user_id} />
                <select
                  name="role"
                  defaultValue={roleByUserId.get(member.user_id) ?? "employee"}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {roleOptions.map((role) => (
                    <option key={`${member.user_id}-${role}`} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{roleByUserId.get(member.user_id) ?? "employee"}</Badge>
                  <Button type="submit" size="sm">
                    Update Role
                  </Button>
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
