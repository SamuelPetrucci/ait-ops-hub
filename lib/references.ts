export const REFERENCE_KINDS = [
  ["article", "Article"],
  ["video", "Video"],
  ["thread", "Thread"],
  ["competitor", "Competitor"],
  ["trend", "Trend"],
  ["research", "Research"],
  ["other", "Other"],
] as const;

export type ReferenceKind = (typeof REFERENCE_KINDS)[number][0];

export type ContentReference = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  url: string;
  notes: string | null;
  niche: string | null;
  kind: ReferenceKind | string;
  tags: string[];
  assigned_agents: string[];
  active: boolean;
  created_by: string;
};

export function kindLabel(kind: string) {
  return REFERENCE_KINDS.find(([id]) => id === kind)?.[1] || kind;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseTagList(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,#\n]/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function parseAgentList(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}
