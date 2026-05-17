import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, ValidationError } from "@/lib/api/errors";
import type { Database, Tables, TablesInsert, UUID } from "@/lib/types/database";

export type CreateOrganizationResult = {
  organization: Tables<"organizations">;
  member: Tables<"org_members">;
  profile: Tables<"profiles">;
};

export async function createOrganization(
  supabase: SupabaseClient<Database>,
  name: string,
  slug: string,
  userId: UUID
): Promise<CreateOrganizationResult> {
  const orgInsert: TablesInsert<"organizations"> = { name, slug };

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert(orgInsert)
    .select("*")
    .maybeSingle();

  if (orgError || !organization) {
    throw new ValidationError({
      message: orgError?.message ?? "Failed to create organization",
      details: orgError,
    });
  }

  const memberInsert: TablesInsert<"org_members"> = {
    organization_id: organization.id,
    user_id: userId,
    role: "owner",
  };

  const { data: member, error: memberError } = await supabase
    .from("org_members")
    .insert(memberInsert)
    .select("*")
    .maybeSingle();

  if (memberError || !member) {
    // best-effort rollback
    await supabase.from("organizations").delete().eq("id", organization.id);
    throw new ValidationError({
      message: memberError?.message ?? "Failed to add org member",
      details: memberError,
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        active_organization_id: organization.id,
      },
      { onConflict: "id" }
    )
    .select("*")
    .maybeSingle();

  if (profileError || !profile) {
    // best-effort rollback
    await supabase.from("org_members").delete().eq("id", member.id);
    await supabase.from("organizations").delete().eq("id", organization.id);
    throw new ValidationError({
      message: profileError?.message ?? "Failed to update user profile",
      details: profileError,
    });
  }

  return { organization, member, profile };
}

export async function getOrganizationById(
  supabase: SupabaseClient<Database>,
  orgId: UUID
): Promise<Tables<"organizations"> | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new ValidationError({ message: error.message, details: error });
  return data ?? null;
}

export async function getUserOrganizations(
  supabase: SupabaseClient<Database>,
  userId: UUID
): Promise<Array<Pick<Tables<"organizations">, "id" | "name" | "slug">>> {
  const { data, error } = await supabase
    .from("org_members")
    .select(
      `
      organization:organizations (
        id,
        name,
        slug
      )
    `
    )
    .eq("user_id", userId);

  if (error) throw new ValidationError({ message: error.message, details: error });

  return (data ?? [])
    .map((d) => d.organization)
    .filter(
      (org): org is Pick<Tables<"organizations">, "id" | "name" | "slug"> =>
        !!org
    );
}

export async function listOrganizationsForUser(
  supabase: SupabaseClient<Database>,
  params: { userId: string }
): Promise<Array<Pick<Tables<"organizations">, "id" | "name" | "slug">>> {
  return getUserOrganizations(supabase, params.userId);
}

export async function listOrganizationMembers(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string }
): Promise<Array<{ userId: string; fullName: string; email: string | null }>> {
  const { data: members, error: memberError } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("organization_id", params.organizationId);

  if (memberError) {
    throw new ValidationError({ message: memberError.message, details: memberError });
  }

  const userIds = members?.map((member) => member.user_id) ?? [];
  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,username")
    .in("id", userIds);

  if (profileError) {
    throw new ValidationError({ message: profileError.message, details: profileError });
  }

  return (profiles ?? []).map((profile) => ({
    userId: profile.id,
    fullName: profile.full_name ?? "Unknown",
    email: profile.username ?? null,
  }));
}

export async function switchActiveOrganization(
  supabase: SupabaseClient<Database>,
  userId: UUID,
  orgId: UUID
): Promise<Tables<"profiles">> {
  // Ensure the user is actually a member of the organization.
  const { data: membership, error: memberError } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (memberError) {
    throw new ValidationError({ message: memberError.message, details: memberError });
  }
  if (!membership) throw new ForbiddenError({ message: "Forbidden: user is not an org member" });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        active_organization_id: orgId,
      },
      { onConflict: "id" }
    )
    .select("*")
    .maybeSingle();

  if (profileError || !profile) {
    throw new ValidationError({
      message: profileError?.message ?? "Failed to switch organization",
      details: profileError,
    });
  }

  return profile;
}
