import type { CompanySizeBucket, DiscoveryCategory } from "@/lib/discovery/categories";

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "AIT-Ops-Hub-Discovery/1.0 (samuel@aitransformation.co)";

function bucketFromEmployees(count: number): CompanySizeBucket {
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  return "200+";
}

/** Heuristic size from OSM tags when Wikidata has no headcount. */
export function estimateSizeFromTags(
  tags: Record<string, string>,
  category: DiscoveryCategory | undefined,
): CompanySizeBucket {
  const brand = tags.brand || tags["brand:wikidata"];
  if (brand) return "51-200";

  const levels = Number(tags["building:levels"] || tags.levels || "");
  if (Number.isFinite(levels) && levels >= 4) return "51-200";
  if (Number.isFinite(levels) && levels >= 2) return "11-50";

  if (tags.operator && tags.name && tags.operator !== tags.name) return "11-50";

  return category?.defaultSize ?? "unknown";
}

export async function fetchWikidataEmployeeBuckets(
  wikidataIds: string[],
): Promise<Map<string, CompanySizeBucket>> {
  const unique = [...new Set(wikidataIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, CompanySizeBucket>();
  if (unique.length === 0) return out;

  // Chunk to keep SPARQL URLs reasonable
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const values = chunk.map((id) => `wd:${id}`).join(" ");
    const query = `
SELECT ?item ?employees WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P1128 ?employees .
}`;
    try {
      const url = `${WIKIDATA_SPARQL}?${new URLSearchParams({
        query,
        format: "json",
      })}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        results?: { bindings?: { item?: { value?: string }; employees?: { value?: string } }[] };
      };
      for (const row of payload.results?.bindings || []) {
        const item = row.item?.value || "";
        const id = item.split("/").pop();
        const employees = Number(row.employees?.value);
        if (id && Number.isFinite(employees) && employees > 0) {
          out.set(id, bucketFromEmployees(employees));
        }
      }
    } catch {
      // Free enrichment is best-effort; fall back to tag heuristics.
    }
  }

  return out;
}

/**
 * Optional free website sniff: look for headcount language on the homepage.
 * Kept short and capped so discovery stays snappy.
 */
export async function estimateSizeFromWebsite(website: string | null | undefined): Promise<CompanySizeBucket | null> {
  if (!website) return null;
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 120_000).toLowerCase();

    const employeesMatch = html.match(/(\d{1,5})\+?\s*(employees|team members|people)/);
    if (employeesMatch) {
      const n = Number(employeesMatch[1]);
      if (Number.isFinite(n) && n > 0) return bucketFromEmployees(n);
    }
    if (/\bfamily[- ]owned\b|\bsolo practice\b|\bsmall business\b/.test(html)) return "1-10";
    if (/\benterprise\b|\bglobal offices\b|\bfortune\b/.test(html)) return "200+";
    if (/\bour team\b/.test(html) && /\bcareers\b/.test(html)) return "11-50";
    return null;
  } catch {
    return null;
  }
}
