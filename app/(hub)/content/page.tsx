import { ContentBoard } from "@/components/boards";
import { requireOwner } from "@/lib/auth";
import { formatWhen, nestedString } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  const { supabase } = await requireOwner();
  const [queue, performance] = await Promise.all([
    supabase
      .from("content_queue")
      .select("id, title, status, platforms, scheduled_at, posted_at, assigned_agent")
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_performance")
      .select("id, platform, post_age, views, comments, shares, measurement_date, classification, content_id, content_queue(title)")
      .order("measurement_date", { ascending: false })
      .limit(100),
  ]);
  if (queue.error) throw new Error(queue.error.message);
  if (performance.error) throw new Error(performance.error.message);

  const calendar = (queue.data ?? [])
    .filter((row) => row.scheduled_at || row.posted_at)
    .map((row) => ({
      id: row.id,
      title: row.title || "Untitled",
      when: row.scheduled_at || row.posted_at,
      platforms: (row.platforms || []).join(", "),
      status: row.status,
    }))
    .sort((a, b) => String(a.when).localeCompare(String(b.when)));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium">Content engine</h1>
        <p className="text-sm text-muted-foreground">
          Dragging changes status only. Moving a card to Posted does not publish it. Agents post approved rows.
        </p>
      </div>
      <ContentBoard
        items={(queue.data ?? []).map((row) => ({
          id: row.id,
          column: row.status,
          title: row.title || "Untitled",
          meta: [(row.platforms || []).slice(0, 2).join(", "), row.assigned_agent].filter(Boolean).join(" · "),
        }))}
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Performance</h2>
        {(performance.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No performance rows yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(performance.data ?? []).map((row) => {
                const title = nestedString(row.content_queue, "title");
                return (
                  <TableRow key={row.id}>
                    <TableCell>{title || "Untitled"}</TableCell>
                    <TableCell>{row.platform}</TableCell>
                    <TableCell>{row.post_age}</TableCell>
                    <TableCell>{row.views ?? "—"}</TableCell>
                    <TableCell>{row.comments ?? "—"}</TableCell>
                    <TableCell>{row.shares ?? "—"}</TableCell>
                    <TableCell>{row.classification || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Posting calendar</h2>
        {calendar.length === 0 ? <p className="text-sm text-muted-foreground">Nothing scheduled or posted.</p> : null}
        <ul className="flex flex-col gap-2">
          {calendar.map((item) => (
            <li key={item.id} className="rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
              <span className="text-muted-foreground">{formatWhen(item.when)}</span> · {item.title}
              <span className="text-muted-foreground"> · {item.platforms || "No platform"} · {item.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
