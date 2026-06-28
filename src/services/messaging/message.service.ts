import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import type { AppRole } from "@/lib/auth/permissions";
import type { Database, Tables, TablesInsert } from "@/lib/types/database";

export type MessageRow = Tables<"messages">;

async function assertOrgMember(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string
): Promise<void> {
  const queryStart = Date.now();
  const { data, error } = await supabase
    .from("org_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  console.info(`[perf] [DB] messaging.service assertOrgMember ${Date.now() - queryStart}ms`);

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }
  if (!data) {
    throw new ForbiddenError({ message: "User is not a member of this organization" });
  }
}

export async function createMessage(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    senderId: string;
    content: string;
    recipientId?: string;
    projectId?: string | null;
  }
): Promise<MessageRow> {
  const content = params.content.trim();
  const recipientId = params.recipientId?.trim() || undefined;
  const projectId = params.projectId?.trim() || undefined;

  if (!content) {
    throw new ValidationError({ message: "Message content is required" });
  }

  if (!recipientId && !projectId) {
    throw new ValidationError({
      message: "Either recipientId or projectId is required",
    });
  }

  if (recipientId && projectId) {
    throw new ValidationError({
      message: "Provide recipientId or projectId, not both",
    });
  }

  const validateStart = Date.now();
  await assertOrgMember(supabase, params.organizationId, params.senderId);

  if (recipientId) {
    // POTENTIAL WATERFALL
    await assertOrgMember(supabase, params.organizationId, recipientId);
  }
  console.info(`[perf] [Fetch] messaging.service createMessage membership checks ${Date.now() - validateStart}ms`);

  if (projectId) {
    const projectStart = Date.now();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    console.info(`[perf] [DB] messaging.service createMessage project check ${Date.now() - projectStart}ms`);

    if (projectError) {
      throw new ValidationError({ message: projectError.message, details: projectError });
    }

    if (!project) {
      throw new NotFoundError({ message: "Project not found in your organization" });
    }
  }

  const insertPayload: TablesInsert<"messages"> = {
    organization_id: params.organizationId,
    sender_id: params.senderId,
    recipient_id: recipientId ?? null,
    content,
  };

  const insertStart = Date.now();
  const { data, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();
  console.info(`[perf] [DB] messaging.service createMessage insert ${Date.now() - insertStart}ms`);

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }
  if (!data) {
    throw new ValidationError({ message: "Unable to create message" });
  }

  return data;
}

export async function listMessages(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    userId: string;
    recipientId?: string;
    projectId?: string;
  }
): Promise<MessageRow[]> {
  const totalStart = Date.now();
  await assertOrgMember(supabase, params.organizationId, params.userId);

  const recipientId = params.recipientId?.trim() || undefined;
  const projectId = params.projectId?.trim() || undefined;

  // Project messages (safe)
  if (projectId) {
    const queryStart = Date.now();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    console.info(`[perf] [DB] messaging.service listMessages project ${Date.now() - queryStart}ms`);

    if (error) {
      console.error("[LIST_MESSAGES_PROJECT_ERROR]", error);
      throw new ValidationError({ message: "Failed to fetch messages" });
    }

    console.info(`[perf] [Fetch] messaging.service listMessages total ${Date.now() - totalStart}ms`);
    return data ?? [];
  }

  // Direct conversation (NO string interpolation)
  if (recipientId) {
    const queryStart = Date.now();
    const [sent, received] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("organization_id", params.organizationId)
        .eq("sender_id", params.userId)
        .eq("recipient_id", recipientId)
        .is("deleted_at", null),

      supabase
        .from("messages")
        .select("*")
        .eq("organization_id", params.organizationId)
        .eq("sender_id", recipientId)
        .eq("recipient_id", params.userId)
        .is("deleted_at", null),
    ]);

    if (sent.error || received.error) {
      console.error("[LIST_MESSAGES_DIRECT_ERROR]", sent.error || received.error);
      throw new ValidationError({ message: "Failed to fetch messages" });
    }

    const computeStart = Date.now();
    const rows = [...(sent.data ?? []), ...(received.data ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    console.info(`[perf] [DB] messaging.service listMessages direct ${Date.now() - queryStart}ms`);
    const computeMs = Date.now() - computeStart;
    if (computeMs > 8) {
      console.info(`[perf] [Compute] messaging.service sort direct messages ${computeMs}ms`);
    }
    console.info(`[perf] [Fetch] messaging.service listMessages total ${Date.now() - totalStart}ms`);
    return rows;
  }

  // All messages involving user
  const queryStart = Date.now();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("organization_id", params.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  console.info(`[perf] [DB] messaging.service listMessages all ${Date.now() - queryStart}ms`);

  if (error) {
    console.error("[LIST_MESSAGES_ALL_ERROR]", error);
    throw new ValidationError({ message: "Failed to fetch messages" });
  }

  const computeStart = Date.now();
  const rows = (data ?? []).filter(
    (m) => m.sender_id === params.userId || m.recipient_id === params.userId
  );
  const computeMs = Date.now() - computeStart;
  if (computeMs > 8) {
    console.info(`[perf] [Compute] messaging.service filter user messages ${computeMs}ms`);
  }
  console.info(`[perf] [Fetch] messaging.service listMessages total ${Date.now() - totalStart}ms`);
  return rows;
}

export async function deleteMessage(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    messageId: string;
    actorId: string;
    actorRole: AppRole;
  }
): Promise<void> {
  const lookupStart = Date.now();
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id,sender_id")
    .eq("organization_id", params.organizationId)
    .eq("id", params.messageId)
    .is("deleted_at", null)
    .maybeSingle();
  console.info(`[perf] [DB] messaging.service deleteMessage lookup ${Date.now() - lookupStart}ms`);

  if (messageError) {
    throw new ValidationError({ message: messageError.message, details: messageError });
  }

  if (!message) {
    throw new NotFoundError({ message: "Message not found" });
  }

  const canDelete =
    params.actorRole === "owner" ||
    params.actorRole === "admin" ||
    message.sender_id === params.actorId;
  if (!canDelete) {
    throw new ForbiddenError({
      message: "Only owner/admin or message sender can delete this message",
    });
  }

  const updateStart = Date.now();
  const { data: updated, error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", params.organizationId)
    .eq("id", params.messageId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  console.info(`[perf] [DB] messaging.service deleteMessage update ${Date.now() - updateStart}ms`);

  if (error) {
    throw new ValidationError({ message: error.message, details: error });
  }
  if (!updated) {
    throw new NotFoundError({ message: "Message not found" });
  }
}
