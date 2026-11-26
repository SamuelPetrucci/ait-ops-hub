import { ReferenceForm } from "@/components/reference-form";
import { ReferenceList } from "@/components/reference-list";
import { requireOwner } from "@/lib/auth";
import type { ContentReference } from "@/lib/references";

export const metadata = { title: "References" };

export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string; niche?: string; q?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireOwner();

  const [refsResult, nichesResult, agentsResult] = await Promise.all([
    supabase
      .from("content_references")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_queue")
      .select("content_pillar")
      .not("content_pillar", "is", null)
      .limit(500),
    supabase.from("agents").select("name").eq("status", "active").order("name"),
  ]);

  const migrationMissing =
    Boolean(refsResult.error) &&
    /content_references|does not exist|Could not find the table/i.test(refsResult.error?.message || "");

  if (refsResult.error && !migrationMissing) throw new Error(refsResult.error.message);

  const rows = ((refsResult.data ?? []) as ContentReference[]).filter((row) => {
    if (params.niche && row.niche !== params.niche) return false;
    if (params.q) {
      const q = params.q.toLowerCase();
      const hay = [row.title, row.url, row.notes, row.niche, ...(row.tags || []), ...(row.assigned_agents || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const niches = [
    ...new Set(
      [
        ...(nichesResult.data ?? []).map((r) => r.content_pillar as string).filter(Boolean),
        ...((refsResult.data ?? []) as ContentReference[]).map((r) => r.niche).filter(Boolean) as string[],
      ].sort(),
    ),
  ];
  const agents = (agentsResult.data ?? []).map((a) => a.name as string).filter(Boolean);
  const activeCount = ((refsResult.data ?? []) as ContentReference[]).filter((r) => r.active).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Content library
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">References</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Source links for Grok agents to create and repurpose content from
            {activeCount ? ` · ${activeCount} active` : ""}.
          </p>
        </div>
      </header>

      {params.error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{params.error}</p>
      ) : null}
      {params.saved ? (
        <p className="rounded-xl bg-signal/10 px-4 py-3 text-sm text-signal">Reference saved.</p>
      ) : null}
      {params.deleted ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Reference deleted.</p>
      ) : null}

      {migrationMissing ? (
        <div className="rounded-2xl bg-card/50 px-6 py-10 text-center ring-1 ring-foreground/10">
          <p className="text-lg font-medium">Apply the references migration first</p>
          <p className="mt-1 max-w-lg mx-auto text-sm text-muted-foreground">
            Paste <code className="text-xs">supabase/migrations/20261123120000_content_references.sql</code> into
            the Supabase SQL editor for project <code className="text-xs">tpoowbghgomkatofzsph</code>, run it, then refresh this page.
          </p>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-tight text-ink">Add a reference</h2>
            <ReferenceForm niches={niches} agents={agents} />
          </section>

          <form className="flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={params.q || ""}
              placeholder="Search title, tags, notes…"
              className="h-8 min-w-[12rem] flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <select
              name="niche"
              defaultValue={params.niche || ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">All niches</option>
              {niches.map((niche) => (
                <option key={niche} value={niche}>
                  {niche}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-sm text-paper hover:bg-ink/90"
            >
              Filter
            </button>
          </form>

          <ReferenceList rows={rows} niches={niches} agents={agents} />
        </>
      )}
    </div>
  );
}
