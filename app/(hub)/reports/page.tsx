import { TrendChart } from "@/components/trend-chart";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth";
import { formatWhen, money } from "@/lib/format";

export const metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string; entry_type?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireOwner();
  let query = supabase
    .from("daily_metrics")
    .select(
      "id, entry_date, entry_type, author, title, emails_sent, replies, new_qualified_prospects, revenue_collected, pipeline_value, bottleneck, next_actions",
    )
    .order("entry_date", { ascending: false })
    .limit(180);
  if (params.author) query = query.eq("author", params.author);
  if (params.entry_type) query = query.eq("entry_type", params.entry_type);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const authors = [...new Set(rows.map((row) => row.author).filter(Boolean))] as string[];
  const types = [...new Set(rows.map((row) => row.entry_type))];
  const byDay = new Map<string, number>();
  for (const row of [...rows].reverse()) {
    const key = String(row.entry_date).slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + Number(row.emails_sent || 0));
  }
  const points = [...byDay.entries()].map(([label, value]) => ({ label: label.slice(5), value }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Daily reports</h1>
        <p className="text-sm text-muted-foreground">Agent and CEO reports already in daily_metrics. The line is emails sent.</p>
      </div>
      <form className="flex flex-wrap gap-2" action="/reports">
        <select name="author" defaultValue={params.author || ""} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Author">
          <option value="">All authors</option>
          {authors.map((author) => (
            <option key={author} value={author}>
              {author}
            </option>
          ))}
        </select>
        <select name="entry_type" defaultValue={params.entry_type || ""} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Type">
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <TrendChart points={points} />
      <ol className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">
              {formatWhen(String(row.entry_date).slice(0, 10))} · {row.author || "Unknown"} · {row.entry_type}
            </p>
            <p className="font-medium">{row.title || "Untitled report"}</p>
            <p className="text-muted-foreground">
              Sent {row.emails_sent ?? "—"} · replies {row.replies ?? "—"} · qualified {row.new_qualified_prospects ?? "—"} · revenue {money(row.revenue_collected)}
            </p>
            {row.next_actions ? <p className="mt-1 whitespace-pre-wrap">{row.next_actions}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
