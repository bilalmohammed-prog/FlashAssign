import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/actions/_helpers/requireOrgContext";
import { authorize } from "@/lib/auth/authorization";
import { addMember } from "@/actions/organization/addMember";
import { listOrgMembers } from "@/actions/organization/listOrgMembers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { uuidSchema } from "@/lib/validation/common";
import type { Database } from "@/lib/types/database";

type RoleType = Database["public"]["Enums"]["role_type"];

const roleOptions: RoleType[] = ["owner", "admin", "manager", "employee", "viewer"];

type SettingsSearchParams = {
  addMemberStatus?: string;
  addMemberMessage?: string;
};

export default async function OrgSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SettingsSearchParams>;
}) {
  const { orgId } = await params;
  const query = await searchParams;

  const ctx = await requireOrgContext({ organizationId: orgId });
  const [membersResult, orgMembersResult] = await Promise.all([
    listOrgMembers(ctx.organizationId),
    ctx.supabase
      .from("org_members")
      .select("user_id,role")
      .eq("organization_id", ctx.organizationId),
  ]);
  const members = membersResult.data ?? [];
  const roleByUserId = new Map((orgMembersResult.data ?? []).map((row) => [row.user_id, row.role]));

  async function inviteMemberMutation(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organizationId") ?? "").trim();
    const userId = String(formData.get("userId") ?? "").trim();
    const role = String(formData.get("role") ?? "employee") as RoleType;

    const validOrgId = uuidSchema.safeParse(organizationId);
    const validUserId = uuidSchema.safeParse(userId);

    if (!validOrgId.success || !validUserId.success) {
      redirect(
        `/organizations/${organizationId}/settings?addMemberStatus=error&addMemberMessage=${encodeURIComponent("Please enter valid UUIDs for organization and user")}`
      );
    }

    const result = await addMember({
      organizationId,
      userId,
      role,
    });

    if (result.error) {
      redirect(
        `/organizations/${organizationId}/settings?addMemberStatus=error&addMemberMessage=${encodeURIComponent(result.error.message)}`
      );
    }

    revalidatePath(`/organizations/${organizationId}/settings`);
    const message = result.data.created
      ? "Member added successfully"
      : "User is already a member of this organization";

    redirect(
      `/organizations/${organizationId}/settings?addMemberStatus=success&addMemberMessage=${encodeURIComponent(message)}`
    );
  }

  async function updateRoleMutation(formData: FormData) {
    "use server";
    const orgCtx = await requireOrgContext({ organizationId: orgId });
    authorize("manage_members", "organization", { role: orgCtx.role });
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "employee") as RoleType;
    if (!userId) return;

    if (orgCtx.role === "admin" && role === "owner") {
      return;
    }

    await orgCtx.supabase
      .from("org_members")
      .update({ role })
      .eq("organization_id", orgCtx.organizationId)
      .eq("user_id", userId);

    revalidatePath(`/organizations/${orgCtx.organizationId}/settings`);
  }

  return (
    <div className="w-full max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground">Manage org members, invites, and roles.</p>
      </div>

      {query.addMemberStatus === "success" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {query.addMemberMessage ?? "Member added successfully"}
        </p>
      )}

      {query.addMemberStatus === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {query.addMemberMessage ?? "Failed to add member"}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Member</CardTitle>
          <CardDescription>Add an existing user to this organization by user ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteMemberMutation} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input type="hidden" name="organizationId" value={ctx.organizationId} />
            <div className="md:col-span-2">
              <Input
                name="userId"
                placeholder="User UUID"
                required
                pattern="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the user ID of an existing account
              </p>
            </div>
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
              <Button type="submit">Add Member</Button>
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
