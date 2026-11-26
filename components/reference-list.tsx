import { deleteReference, toggleReferenceActive } from "@/app/actions/references";
import { ReferenceForm } from "@/components/reference-form";
import { Button } from "@/components/ui/button";
import { hostOf, kindLabel, type ContentReference } from "@/lib/references";
import { formatWhen } from "@/lib/format";

export function ReferenceList({
  rows,
  niches,
  agents,
}: {
  rows: ContentReference[];
  niches: string[];
  agents: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-card/50 px-6 py-12 text-center ring-1 ring-foreground/10">
        <p className="text-lg font-medium">No references yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add source links above. Grok agents will pull from active rows to create and repurpose content.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-2xl bg-card/60 ring-1 ring-foreground/10">
          <details className="group">
            <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium tracking-tight">{row.title}</p>
                  {!row.active ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      Paused
                    </span>
                  ) : null}
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {kindLabel(row.kind)}
                  </span>
                  {row.niche ? (
                    <span className="rounded-full bg-signal/10 px-2 py-0.5 text-[11px] text-signal">
                      {row.niche}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{hostOf(row.url)}</p>
                {row.notes ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.notes}</p>
                ) : null}
                {(row.tags?.length || row.assigned_agents?.length) ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[
                      row.tags?.length ? `tags: ${row.tags.join(", ")}` : null,
                      row.assigned_agents?.length
                        ? `agents: ${row.assigned_agents.join(", ")}`
                        : "agents: all content agents",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Available to all content agents</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatWhen(row.updated_at)}</span>
                <span className="text-xs text-muted-foreground group-open:hidden">Edit</span>
              </div>
            </summary>
            <div className="border-t border-foreground/10 px-4 py-4">
              <ReferenceForm reference={row} niches={niches} agents={agents} />
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm hover:bg-muted"
                >
                  Open link
                </a>
                <form action={toggleReferenceActive}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="active" value={row.active ? "false" : "true"} />
                  <Button type="submit" variant="outline" size="sm">
                    {row.active ? "Pause" : "Activate"}
                  </Button>
                </form>
                <form action={deleteReference}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
