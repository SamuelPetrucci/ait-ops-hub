"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { parseAgentList, parseTagList, type ReferenceKind } from "@/lib/references";

const KINDS = new Set([
  "article",
  "video",
  "thread",
  "competitor",
  "trend",
  "research",
  "other",
]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function refresh() {
  revalidatePath("/references");
  revalidatePath("/content");
  revalidatePath("/", "layout");
}

export async function createReference(formData: FormData) {
  const { supabase } = await requireOwner();
  const title = text(formData, "title");
  const url = normalizeUrl(text(formData, "url"));
  const notes = text(formData, "notes");
  const niche = text(formData, "niche");
  const kindRaw = text(formData, "kind") || "article";
  const kind = (KINDS.has(kindRaw) ? kindRaw : "other") as ReferenceKind;
  const tags = parseTagList(text(formData, "tags"));
  const assigned_agents = parseAgentList(text(formData, "assigned_agents"));

  if (!url) redirect("/references?error=" + encodeURIComponent("A valid URL is required"));
  if (!title) redirect("/references?error=" + encodeURIComponent("Give the reference a title"));

  const { error } = await supabase.from("content_references").insert({
    title,
    url,
    notes: notes || null,
    niche: niche || null,
    kind,
    tags,
    assigned_agents,
    active: true,
    created_by: "Samuel",
  });

  if (error) redirect(`/references?error=${encodeURIComponent(error.message)}`);
  refresh();
  redirect("/references?saved=1");
}

export async function updateReference(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const title = text(formData, "title");
  const url = normalizeUrl(text(formData, "url"));
  const notes = text(formData, "notes");
  const niche = text(formData, "niche");
  const kindRaw = text(formData, "kind") || "article";
  const kind = (KINDS.has(kindRaw) ? kindRaw : "other") as ReferenceKind;
  const tags = parseTagList(text(formData, "tags"));
  const assigned_agents = parseAgentList(text(formData, "assigned_agents"));
  const active = text(formData, "active") !== "false";

  if (!id) redirect("/references?error=" + encodeURIComponent("Missing reference id"));
  if (!url) redirect("/references?error=" + encodeURIComponent("A valid URL is required"));
  if (!title) redirect("/references?error=" + encodeURIComponent("Give the reference a title"));

  const { error } = await supabase
    .from("content_references")
    .update({
      title,
      url,
      notes: notes || null,
      niche: niche || null,
      kind,
      tags,
      assigned_agents,
      active,
    })
    .eq("id", id);

  if (error) redirect(`/references?error=${encodeURIComponent(error.message)}`);
  refresh();
  redirect("/references?saved=1");
}

export async function toggleReferenceActive(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  const active = text(formData, "active") === "true";
  if (!id) redirect("/references?error=" + encodeURIComponent("Missing reference id"));

  const { error } = await supabase.from("content_references").update({ active }).eq("id", id);
  if (error) redirect(`/references?error=${encodeURIComponent(error.message)}`);
  refresh();
  redirect("/references");
}

export async function deleteReference(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = text(formData, "id");
  if (!id) redirect("/references?error=" + encodeURIComponent("Missing reference id"));

  const { error } = await supabase.from("content_references").delete().eq("id", id);
  if (error) redirect(`/references?error=${encodeURIComponent(error.message)}`);
  refresh();
  redirect("/references?deleted=1");
}
