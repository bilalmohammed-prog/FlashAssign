import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { UnauthorizedError, ValidationError } from "@/lib/api/errors";
import { toAppRole, type AppRole, type DatabaseRole } from "./permissions";
import { getSupabaseServer } from "@/lib/supabase/server";

type MembershipRow = {
  organization_id: string;
  role: DatabaseRole;
};

export type TenantContext = {
  supabase: SupabaseClient<Database>;
  user: User;
  userId: string;
  organizationId: string;
  databaseRole: DatabaseRole;
  role: AppRole;
};

let tenantContextTraceId = 0;

export async function getActiveOrganizationIdFromCookie(): Promise<string | undefined> {
  const traceId = ++tenantContextTraceId;
  const label = `[DB] org lookup cookie #${traceId}`;
  console.time(label);
  const cookieStore = await cookies();
  const value = cookieStore.get("activeOrg")?.value;
  console.timeEnd(label);
  return value;
}

async function isUserInOrganization(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string
): Promise<boolean> {
  const traceId = ++tenantContextTraceId;
  const label = `[DB] membership lookup isUserInOrganization #${traceId}`;
  console.time(label);
  const { data, error } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  console.timeEnd(label);

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }

  return Boolean(data?.id);
}

async function getFirstMembershipOrganizationId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const traceId = ++tenantContextTraceId;
  const label = `[DB] membership lookup first organization #${traceId}`;
  console.time(label);
  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  console.timeEnd(label);

  if (membershipError) {
    throw new ValidationError({ message: membershipError.message, details: membershipError });
  }

  return membership?.organization_id ?? null;
}

export async function resolveActiveOrganizationId(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId?: string | null
): Promise<string | null> {
  const traceId = ++tenantContextTraceId;
  const orgLabel = `[DB] org lookup resolveActiveOrganizationId #${traceId}`;
  const profileLabel = `[DB] profile lookup active organization #${traceId}`;
  const upsertLabel = `[DB] profile lookup active organization upsert #${traceId}`;
  console.time(orgLabel);
  if (organizationId) {
    console.timeEnd(orgLabel);
    return organizationId;
  }

  const cookieOrgId = await getActiveOrganizationIdFromCookie();
  if (cookieOrgId && (await isUserInOrganization(supabase, userId, cookieOrgId))) {
    console.timeEnd(orgLabel);
    return cookieOrgId;
  }

  console.time(profileLabel);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_organization_id")
    .eq("id", userId)
    .maybeSingle();
  console.timeEnd(profileLabel);

  if (profileError) {
    throw new ValidationError({ message: profileError.message, details: profileError });
  }

  if (
    profile?.active_organization_id &&
    (await isUserInOrganization(supabase, userId, profile.active_organization_id))
  ) {
    console.timeEnd(orgLabel);
    return profile.active_organization_id;
  }

  const fallbackOrgId = await getFirstMembershipOrganizationId(supabase, userId);
  if (!fallbackOrgId) {
    console.timeEnd(orgLabel);
    return null;
  }

  console.time(upsertLabel);
  const { error: updateProfileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        active_organization_id: fallbackOrgId,
      },
      { onConflict: "id" }
    );
  console.timeEnd(upsertLabel);

  if (updateProfileError) {
    throw new ValidationError({ message: updateProfileError.message, details: updateProfileError });
  }

  console.timeEnd(orgLabel);
  return fallbackOrgId;
}

export async function getTenantContext(
  supabase: SupabaseClient<Database>,
  user: User,
  options?: { organizationId?: string | null }
): Promise<TenantContext> {
  const traceId = ++tenantContextTraceId;
  const totalLabel = `[Action] getTenantContext total #${traceId}`;
  const membershipLabel = `[DB] membership lookup tenant role #${traceId}`;
  console.time(totalLabel);
  const organizationId = await resolveActiveOrganizationId(
    supabase,
    user.id,
    options?.organizationId
  );

  if (!organizationId) {
    console.timeEnd(totalLabel);
    return {
      supabase,
      user,
      userId: user.id,
      organizationId: null,
      databaseRole: null,
      role: null,
    } as unknown as TenantContext;
  }

  console.time(membershipLabel);
  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle<MembershipRow>();
  console.timeEnd(membershipLabel);

  if (membershipError) {
    throw new ValidationError({ message: membershipError.message, details: membershipError });
  }

  if (!membership) {
    console.timeEnd(totalLabel);
    return {
      supabase,
      user,
      userId: user.id,
      organizationId: null,
      databaseRole: null,
      role: null,
    } as unknown as TenantContext;
  }

  console.timeEnd(totalLabel);
  return {
    supabase,
    user,
    userId: user.id,
    organizationId,
    databaseRole: membership.role,
    role: toAppRole(membership.role),
  };
}

export async function requireTenantContext(
  _req: Request,
  options?: { organizationId?: string | null }
): Promise<TenantContext> {
  const traceId = ++tenantContextTraceId;
  const totalLabel = `[Action] requireTenantContext total #${traceId}`;
  const clientLabel = `[Fetch] requireTenantContext supabase client #${traceId}`;
  const authLabel = `[DB] auth/session #${traceId}`;
  console.time(totalLabel);
  console.time(clientLabel);
  const supabase = await getSupabaseServer();
  console.timeEnd(clientLabel);

  console.time(authLabel);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  console.timeEnd(authLabel);

  if (authError || !user) {
    console.timeEnd(totalLabel);
    throw new UnauthorizedError();
  }

  const tenant = await getTenantContext(supabase, user, options);
  console.timeEnd(totalLabel);
  return tenant;
}
