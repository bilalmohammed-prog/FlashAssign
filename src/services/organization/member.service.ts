import type { SupabaseClient } from "@supabase/supabase-js";
import { ValidationError } from "@/lib/api/errors";
import type { Database, Tables, TablesInsert } from "@/lib/types/database";
import { createAuditLog } from "@/services/audit/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AddMemberResult = {
  member: Tables<"org_members">;
  created: boolean;
};

export type UpdateMemberRoleResult = {
  member: Tables<"org_members">;
  updated: boolean;
};

export async function addMember(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    userId: string;
    role: Database["public"]["Enums"]["role_type"];
    actorId: string;
  }
): Promise<AddMemberResult> {
  const { data: existing, error: existingError } = await supabase
    .from("org_members")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existingError) {
    throw new ValidationError({ message: existingError.message, details: existingError });
  }

  if (existing) {
    return { member: existing, created: false };
  }

  const insertPayload: TablesInsert<"org_members"> = {
    organization_id: params.organizationId,
    user_id: params.userId,
    role: params.role,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("org_members")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: afterConflict, error: readAfterConflictError } = await supabase
        .from("org_members")
        .select("*")
        .eq("organization_id", params.organizationId)
        .eq("user_id", params.userId)
        .maybeSingle();

      if (readAfterConflictError) {
        throw new ValidationError({
          message: readAfterConflictError.message,
          details: readAfterConflictError,
        });
      }

      if (afterConflict) {
        return { member: afterConflict, created: false };
      }
    }

    throw new ValidationError({ message: insertError.message, details: insertError });
  }

  if (!inserted) {
    throw new ValidationError({ message: "Unable to add member" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", params.userId)
    .maybeSingle();

  if (profileError) {
    throw new ValidationError({ message: profileError.message, details: profileError });
  }

  void createAuditLog(supabaseAdmin, {
    organizationId: params.organizationId,
    projectId: null,
    actorId: params.actorId,
    action: "CREATE",
    entityType: "member",
    entityId: inserted.id,
    changes: [
      {
        field: "full_name",
        before: null,
        after: profile?.full_name ?? null,
      },
      {
        field: "role",
        before: null,
        after: inserted.role,
      },
    ],
  });

  return { member: inserted, created: true };
}

export async function removeMember(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    userId: string;
    actorId: string;
  }
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("org_members")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existingError) {
    throw new ValidationError({ message: existingError.message, details: existingError });
  }

  if (!existing) {
    throw new ValidationError({ message: "Member not found" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", params.userId)
    .maybeSingle();

  if (profileError) {
    throw new ValidationError({ message: profileError.message, details: profileError });
  }

  const { error: deleteError } = await supabase
    .from("org_members")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (deleteError) {
    throw new ValidationError({ message: deleteError.message, details: deleteError });
  }

  void createAuditLog(supabaseAdmin, {
    organizationId: params.organizationId,
    projectId: null,
    actorId: params.actorId,
    action: "DELETE",
    entityType: "member",
    entityId: existing.id,
    changes: [
      {
        field: "full_name",
        before: profile?.full_name ?? null,
        after: null,
      },
      {
        field: "role",
        before: existing.role,
        after: null,
      },
    ],
  });
}

export async function updateMemberRole(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    userId: string;
    role: Database["public"]["Enums"]["role_type"];
    actorId: string;
  }
): Promise<UpdateMemberRoleResult> {
  const { data: existing, error: existingError } = await supabase
    .from("org_members")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existingError) {
    throw new ValidationError({ message: existingError.message, details: existingError });
  }

  if (!existing) {
    throw new ValidationError({ message: "Member not found" });
  }

  if (existing.role === params.role) {
    return { member: existing, updated: false };
  }

  const { data: updated, error: updateError } = await supabase
    .from("org_members")
    .update({ role: params.role })
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new ValidationError({ message: updateError.message, details: updateError });
  }

  if (!updated) {
    throw new ValidationError({ message: "Unable to update member role" });
  }

  void createAuditLog(supabaseAdmin, {
    organizationId: params.organizationId,
    projectId: null,
    actorId: params.actorId,
    action: "UPDATE",
    entityType: "member",
    entityId: existing.id,
    changes: [
      {
        field: "role",
        before: existing.role,
        after: params.role,
      },
    ],
  });

  return { member: updated, updated: true };
}
