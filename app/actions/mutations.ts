"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { requireOwner } from "@/lib/auth";
import { DEAL_TO_PROSPECT } from "@/lib/constants";
import { byContentRecency } from "@/lib/content";
import { addDays, nyToday } from "@/lib/format";
import { SESSION_COOKIE } from "@/lib/session";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: string) {
  return value.length > 0 ? value : null;
}

function refresh(paths: string[]) {
  for (const path of paths) revalidatePath(path);
  revalidatePath("/", "layout");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function saveView(formData: FormData) {
  const { supabase } = await requireOwner();
  const name = text(formData, "name");
  const resource = text(formData, "resource") || "prospects";
  const returnTo = text(formData, "return_to") || "/leads";
  const filters = JSON.parse(text(formData, "filters") || "{}") as Record<string, string>;
  if (!name) redirect(`${returnTo}?error=Name%20the%20view%20first`);
  const { error } = await supabase.from("saved_views").insert({
    name,
    resource,
    filters,
    created_by: "Samuel",
  });
  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  refresh(["/leads", "/clients", "/companies"]);
}

export async function deleteView(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const returnTo = text(formData, "return_to") || "/leads";
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  refresh(["/leads", "/clients", "/companies"]);
}

export async function logTouch(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const kind = text(formData, "kind") === "call" ? "call" : "note";
  const body = text(formData, "body");
  if (!body) redirect(`/companies/${prospectId}?error=Write%20a%20note%20first`);
  await logActivity(supabase, {
    entityType: "prospect",
    entityId: prospectId,
    action: kind,
    details: { body },
  });
  refresh([`/companies/${prospectId}`, "/activity"]);
}

export async function scheduleFollowUp(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const date = text(formData, "date");
  if (!date) redirect(`/companies/${prospectId}?error=Pick%20a%20date`);
  const { error } = await supabase
    .from("prospects")
    .update({ next_follow_up_due: date })
    .eq("id", prospectId);
  if (error) redirect(`/companies/${prospectId}?error=${encodeURIComponent(error.message)}`);
  await logActivity(supabase, {
    entityType: "prospect",
    entityId: prospectId,
    action: "follow_up",
    details: { next_follow_up_due: date },
  });
  refresh([`/companies/${prospectId}`, "/follow-ups", "/companies"]);
}

export async function snoozeFollowUp(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const days = Number(text(formData, "days") || "1");
  const current = text(formData, "current");
  const today = nyToday();
  const base = current && current > today ? current : today;
  const next = addDays(base, Number.isFinite(days) ? days : 1);
  const { error } = await supabase
    .from("prospects")
    .update({ next_follow_up_due: next })
    .eq("id", prospectId);
  if (error) redirect(`/follow-ups?error=${encodeURIComponent(error.message)}`);
  await logActivity(supabase, {
    entityType: "prospect",
    entityId: prospectId,
    action: "snooze",
    details: { next_follow_up_due: next, days },
  });
  refresh(["/follow-ups", `/companies/${prospectId}`]);
}

export async function completeFollowUp(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const { error } = await supabase
    .from("prospects")
    .update({ next_follow_up_due: null })
    .eq("id", prospectId);
  if (error) redirect(`/follow-ups?error=${encodeURIComponent(error.message)}`);
  await logActivity(supabase, {
    entityType: "prospect",
    entityId: prospectId,
    action: "complete_follow_up",
    details: {},
  });
  refresh(["/follow-ups", `/companies/${prospectId}`]);
}

export async function createContact(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const name = text(formData, "name");
  if (!name) redirect(`/companies/${prospectId}?error=Contact%20name%20is%20required`);
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      prospect_id: prospectId,
      name,
      email: optional(text(formData, "email")),
      phone: optional(text(formData, "phone")),
      title: optional(text(formData, "title")),
      is_primary: formData.get("is_primary") === "on",
      notes: optional(text(formData, "notes")),
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(`/companies/${prospectId}?error=${encodeURIComponent(error?.message || "Could not add contact")}`);
  }
  await logActivity(supabase, {
    entityType: "prospect",
    entityId: prospectId,
    action: "created_contact",
    details: { contact_id: data.id, name },
  });
  refresh([`/companies/${prospectId}`]);
}

export async function createDeal(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const service = text(formData, "service");
  const status = text(formData, "status") || "researched";
  if (!service) redirect(`/companies/${prospectId}?error=Service%20is%20required`);
  const value = text(formData, "value");
  const probability = Number(text(formData, "probability") || "20");
  const { data, error } = await supabase
    .from("deals")
    .insert({
      prospect_id: prospectId,
      service,
      value: value ? Number(value) : null,
      probability: Number.isFinite(probability) ? Math.min(100, Math.max(0, probability)) : 0,
      expected_close: optional(text(formData, "expected_close")),
      status,
      notes: optional(text(formData, "notes")),
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(`/companies/${prospectId}?error=${encodeURIComponent(error?.message || "Could not create deal")}`);
  }
  const stage = DEAL_TO_PROSPECT[status];
  if (stage) {
    await supabase.from("prospects").update({ stage }).eq("id", prospectId);
  }
  await logActivity(supabase, {
    entityType: "deal",
    entityId: data.id,
    action: "created_deal",
    details: { prospect_id: prospectId, service, status, value },
  });
  refresh([`/companies/${prospectId}`, "/pipeline", "/revenue"]);
}

export async function moveDeal(id: string, status: string) {
  const { supabase } = await requireOwner();
  const probability =
    status === "won" ? 100 : status === "lost" || status === "do_not_contact" ? 0 : undefined;
  const { data, error } = await supabase
    .from("deals")
    .update({ status, ...(probability == null ? {} : { probability }) })
    .eq("id", id)
    .select("id, prospect_id, service")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not move deal");
  const stage = DEAL_TO_PROSPECT[status];
  if (stage) {
    const { error: stageError } = await supabase
      .from("prospects")
      .update({ stage })
      .eq("id", data.prospect_id);
    if (stageError) throw new Error(stageError.message);
  }
  await logActivity(supabase, {
    entityType: "deal",
    entityId: id,
    action: "status_change",
    details: { status, prospect_id: data.prospect_id, service: data.service },
  });
  refresh(["/pipeline", `/companies/${data.prospect_id}`, "/revenue"]);
}

export async function createTask(formData: FormData) {
  const { supabase } = await requireOwner();
  const title = text(formData, "title");
  const prospectId = optional(text(formData, "prospect_id"));
  const returnTo = text(formData, "return_to") || "/tasks";
  if (!title) redirect(`${returnTo}?error=Task%20title%20is%20required`);
  const priority = optional(text(formData, "priority"));
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      assigned_agent: optional(text(formData, "assigned_agent")),
      status: "not_started",
      priority,
      due_date: optional(text(formData, "due_date")),
      prospect_id: prospectId,
      content_id: optional(text(formData, "content_id")),
    })
    .select("id")
    .single();
  if (error || !data) redirect(`${returnTo}?error=${encodeURIComponent(error?.message || "Could not create task")}`);
  await logActivity(supabase, {
    entityType: "task",
    entityId: data.id,
    action: "created_task",
    details: { title, prospect_id: prospectId },
  });
  refresh(["/tasks", prospectId ? `/companies/${prospectId}` : "/tasks"]);
}

export async function moveTask(id: string, status: string) {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select("id, title, prospect_id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not move task");
  await logActivity(supabase, {
    entityType: "task",
    entityId: id,
    action: "status_change",
    details: { status, title: data.title, prospect_id: data.prospect_id },
  });
  refresh(["/tasks", data.prospect_id ? `/companies/${data.prospect_id}` : "/tasks"]);
}

export async function draftOutreach(formData: FormData) {
  const { supabase } = await requireOwner();
  const prospectId = text(formData, "prospect_id");
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  if (!subject || !body) {
    redirect(`/companies/${prospectId}?error=Subject%20and%20body%20are%20required`);
  }
  const { data, error } = await supabase
    .from("outreach_messages")
    .insert({
      prospect_id: prospectId,
      channel: "email",
      sequence_step: optional(text(formData, "sequence_step")) || "initial",
      subject,
      body,
      status: "pending_approval",
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(`/companies/${prospectId}?error=${encodeURIComponent(error?.message || "Could not save draft")}`);
  }
  await logActivity(supabase, {
    entityType: "outreach",
    entityId: data.id,
    action: "drafted_outreach",
    details: { prospect_id: prospectId, subject, status: "pending_approval" },
  });
  refresh([`/companies/${prospectId}`, "/approvals"]);
}

async function stampReview(
  table: "approvals" | "outreach_messages" | "content_queue",
  id: string,
  status: string,
  reviewNotes: string,
) {
  const { supabase } = await requireOwner();
  const { error } = await supabase
    .from(table)
    .update({
      status,
      approved_by: "Samuel",
      review_notes: reviewNotes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(supabase, {
    entityType: table === "outreach_messages" ? "outreach" : table === "content_queue" ? "content" : "approval",
    entityId: id,
    action: "review",
    details: { status, review_notes: reviewNotes },
  });
  return supabase;
}

export async function reviewApproval(formData: FormData) {
  const id = text(formData, "id");
  const decision = text(formData, "decision");
  const notes = text(formData, "review_notes");
  await stampReview("approvals", id, decision, notes);
  refresh(["/approvals"]);
}

export async function reviewOutreach(formData: FormData) {
  const id = text(formData, "id");
  const decision = text(formData, "decision");
  const notes = text(formData, "review_notes");
  const prospectId = text(formData, "prospect_id");
  await stampReview("outreach_messages", id, decision, notes);
  refresh(["/approvals", prospectId ? `/companies/${prospectId}` : "/approvals"]);
}

export async function reviewContent(formData: FormData) {
  const id = text(formData, "id");
  const decision = text(formData, "decision");
  const notes = text(formData, "review_notes");
  await stampReview("content_queue", id, decision, notes);
  refresh(["/approvals", "/content"]);
}

export async function moveContent(id: string, status: string) {
  const { supabase } = await requireOwner();
  const patch: { status: string; posted_at?: string | null } = { status };
  if (status === "posted") patch.posted_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("content_queue")
    .update(patch)
    .eq("id", id)
    .select("id, title")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not move content");
  await logActivity(supabase, {
    entityType: "content",
    entityId: id,
    action: "status_change",
    details: { status, title: data.title, posted: false },
  });
  refresh(["/content", "/approvals"]);
}

export async function scheduleToBuffer(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const scheduledAt = text(formData, "scheduled_at");
  const clientVideoUrl = text(formData, "video_url");
  const caption = text(formData, "caption");
  const youtubeTitle = text(formData, "youtube_title");
  const channels = formData.getAll("channels").map(String);

  if (!id) throw new Error("Content ID is required");
  if (!scheduledAt) throw new Error("Schedule time is required");
  if (channels.length === 0) throw new Error("Select at least one channel");

  const {
    buildPostDescription,
    bufferPublishToken,
    createBufferScheduledPost,
    nyLocalInputToDueAt,
    resolveChannelIds,
    truncateYoutubeTitle,
  } = await import("@/lib/buffer-publish");
  const { resolveVideoUrl, scriptParts } = await import("@/lib/content");

  if (!bufferPublishToken()) {
    throw new Error("BUFFER_API_KEY is not configured on the server");
  }

  const resolved = resolveChannelIds(channels);
  if (resolved.length === 0) {
    throw new Error("No valid Buffer channel IDs configured for selected channels");
  }

  const { data: row, error: rowError } = await supabase
    .from("content_queue")
    .select("id, content_id, title, caption, script_json, video_url, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (rowError || !row) throw new Error(rowError?.message || "Content not found");

  const permanentUrl =
    row.video_url?.startsWith("http://") || row.video_url?.startsWith("https://")
      ? row.video_url
      : null;
  const resolvedUrl = permanentUrl || (await resolveVideoUrl(row)) || clientVideoUrl || null;
  if (!resolvedUrl) throw new Error("No public video URL available for this content");
  if (!/^https?:\/\//i.test(resolvedUrl)) throw new Error("Video must be a public https URL");

  const script = scriptParts(row.script_json, caption || row.caption);
  const description = buildPostDescription({
    caption: caption || script.caption,
    hook: script.hook,
    cta: script.cta,
    title: row.title,
    contentId: row.content_id,
  });
  if (!description.trim()) {
    throw new Error("Add a caption/description before scheduling — posts cannot go out blank.");
  }

  const dueAt = nyLocalInputToDueAt(scheduledAt);
  const ytTitle = truncateYoutubeTitle(youtubeTitle || script.hook || row.title || row.content_id || "Viral Digest");
  const errors: string[] = [];
  const successes: string[] = [];

  for (const channel of resolved) {
    try {
      await createBufferScheduledPost({
        channelId: channel.id,
        channelKey: channel.key,
        text: description,
        videoUrl: resolvedUrl,
        dueAt,
        youtubeTitle: ytTitle,
      });
      successes.push(channel.key);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${channel.key}: ${msg}`);
      if (msg.includes("10-post limit")) throw new Error(msg);
    }
  }

  if (successes.length === 0) {
    throw new Error(`Failed to schedule: ${errors.join("; ")}`);
  }

  const { error: updateError } = await supabase
    .from("content_queue")
    .update({
      status: "scheduled",
      scheduled_at: dueAt,
      caption: description,
      ...(errors.length
        ? {
            review_notes: `Buffer partial: ok=${successes.join(",")} fail=${errors.join(" | ")}`,
          }
        : {}),
    })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);

  await logActivity(supabase, {
    entityType: "content",
    entityId: id,
    action: "scheduled_to_buffer",
    details: {
      scheduled_at: dueAt,
      channels: successes,
      description_chars: description.length,
      youtube_title: ytTitle,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  refresh(["/content", "/approvals", "/"]);

  if (errors.length > 0) {
    throw new Error(
      `Scheduled on ${successes.join(", ")} but failed on ${errors.join("; ")}. Re-run only the failed channels in Buffer if needed.`,
    );
  }
}

export async function getNextFreeSlot() {
  try {
    const { supabase } = await requireOwner();
    const { suggestNextPostSlot, bufferChannelId } = await import("@/lib/buffer-publish");

    const horizon = new Date(Date.now() + 14 * 86400000).toISOString();
    const { data: scheduled } = await supabase
      .from("content_queue")
      .select("scheduled_at")
      .in("status", ["scheduled", "approved"])
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", horizon);

    const suggestion = await suggestNextPostSlot({
      usedIsoTimes: (scheduled || []).map((row) => row.scheduled_at).filter(Boolean) as string[],
      channelIds: [bufferChannelId("youtube_viral_digests"), bufferChannelId("instagram")],
    });
    return suggestion.localValue;
  } catch {
    // Never break page render over slot suggestion.
    const tomorrow = new Date(Date.now() + 86400000);
    const y = tomorrow.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    return `${y}T12:00`;
  }
}

export async function recordPayment(formData: FormData) {
  const { supabase } = await requireOwner();
  const dealId = text(formData, "deal_id");
  const amount = Number(text(formData, "amount"));
  if (!dealId || !Number.isFinite(amount)) redirect("/revenue?error=Deal%20and%20amount%20are%20required");
  const { data, error } = await supabase
    .from("payments")
    .insert({
      deal_id: dealId,
      amount,
      date: text(formData, "date") || nyToday(),
      method: optional(text(formData, "method")),
      status: text(formData, "status") || "paid",
      notes: optional(text(formData, "notes")),
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/revenue?error=${encodeURIComponent(error?.message || "Could not record payment")}`);
  await logActivity(supabase, {
    entityType: "deal",
    entityId: dealId,
    action: "payment",
    details: { payment_id: data.id, amount, status: text(formData, "status") || "paid" },
  });
  refresh(["/revenue", "/"]);
}

export async function recordExpense(formData: FormData) {
  const { supabase } = await requireOwner();
  const item = text(formData, "item");
  const amount = Number(text(formData, "amount"));
  if (!item || !Number.isFinite(amount)) redirect("/revenue?error=Item%20and%20amount%20are%20required");
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      item,
      amount,
      category: optional(text(formData, "category")),
      vendor: optional(text(formData, "vendor")),
      incurred_on: text(formData, "incurred_on") || nyToday(),
      notes: optional(text(formData, "notes")),
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/revenue?error=${encodeURIComponent(error?.message || "Could not record expense")}`);
  await logActivity(supabase, {
    entityType: "expense",
    entityId: data.id,
    action: "created_expense",
    details: { item, amount },
  });
  refresh(["/revenue"]);
}

export async function setAgentStatus(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const status = text(formData, "status") === "paused" ? "paused" : "active";
  const { error } = await supabase.from("agents").update({ status }).eq("id", id);
  if (error) redirect(`/agents/${id}?error=${encodeURIComponent(error.message)}`);
  await logActivity(supabase, {
    entityType: "agent",
    entityId: id,
    action: "status_change",
    details: { status },
  });
  refresh(["/agents", `/agents/${id}`]);
}

export async function addDirective(formData: FormData) {
  const { supabase } = await requireOwner();
  const agentId = text(formData, "agent_id");
  const directive = text(formData, "directive");
  if (!directive) redirect(`/agents/${agentId}?error=Write%20a%20directive`);
  const { count } = await supabase
    .from("agent_directives")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);
  const { data, error } = await supabase
    .from("agent_directives")
    .insert({
      agent_id: agentId,
      directive,
      priority: text(formData, "priority") || "medium",
      active: true,
      sort_order: count ?? 0,
      created_by: "Samuel",
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/agents/${agentId}?error=${encodeURIComponent(error?.message || "Could not add directive")}`);
  await logActivity(supabase, {
    entityType: "agent",
    entityId: agentId,
    action: "directive_added",
    details: { directive_id: data.id },
  });
  refresh([`/agents/${agentId}`, "/agents"]);
}

export async function updateDirective(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const agentId = text(formData, "agent_id");
  const active = formData.get("active") === "on" || text(formData, "active") === "true";
  const { error } = await supabase
    .from("agent_directives")
    .update({
      directive: text(formData, "directive"),
      priority: text(formData, "priority") || "medium",
      active,
    })
    .eq("id", id);
  if (error) redirect(`/agents/${agentId}?error=${encodeURIComponent(error.message)}`);
  await logActivity(supabase, {
    entityType: "agent",
    entityId: agentId,
    action: "directive_updated",
    details: { directive_id: id, active },
  });
  refresh([`/agents/${agentId}`]);
}

export async function reorderDirective(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const agentId = text(formData, "agent_id");
  const direction = text(formData, "direction");
  const { data: rows, error } = await supabase
    .from("agent_directives")
    .select("id, sort_order")
    .eq("agent_id", agentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !rows) redirect(`/agents/${agentId}?error=${encodeURIComponent(error?.message || "Could not reorder")}`);
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  const next = [...rows];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  for (let i = 0; i < next.length; i += 1) {
    const { error: updateError } = await supabase
      .from("agent_directives")
      .update({ sort_order: i })
      .eq("id", next[i].id);
    if (updateError) redirect(`/agents/${agentId}?error=${encodeURIComponent(updateError.message)}`);
  }
  await logActivity(supabase, {
    entityType: "agent",
    entityId: agentId,
    action: "directive_reordered",
    details: { directive_id: id, direction },
  });
  refresh([`/agents/${agentId}`]);
}

export async function searchHub(query: string) {
  const { supabase } = await requireOwner();
  const q = query.trim().replace(/[%_,]/g, "");
  let companies = supabase.from("prospects").select("id, company, stage").limit(8);
  companies = q
    ? companies.ilike("company", `%${q}%`)
    : companies.order("updated_at", { ascending: false });
  let deals = supabase
    .from("deals")
    .select("id, service, status, prospect_id, prospects(company)")
    .limit(8);
  deals = q ? deals.ilike("service", `%${q}%`) : deals.order("updated_at", { ascending: false });
  let agents = supabase.from("agents").select("id, name, role, status").limit(8);
  agents = q ? agents.ilike("name", `%${q}%`) : agents.order("name");
  let content = supabase
    .from("content_queue")
    .select("id, title, content_id, status, posted_at, updated_at, created_at, scheduled_at")
    .limit(24);
  content = q
    ? content.or(`title.ilike.%${q}%,content_id.ilike.%${q}%`)
    : content.order("updated_at", { ascending: false });

  const [companyRes, dealRes, agentRes, contentRes] = await Promise.all([companies, deals, agents, content]);
  if (companyRes.error) throw new Error(companyRes.error.message);
  if (dealRes.error) throw new Error(dealRes.error.message);
  if (agentRes.error) throw new Error(agentRes.error.message);
  if (contentRes.error) throw new Error(contentRes.error.message);

  return {
    companies: companyRes.data ?? [],
    deals: dealRes.data ?? [],
    agents: agentRes.data ?? [],
    content: [...(contentRes.data ?? [])].sort(byContentRecency).slice(0, 8),
  };
}
