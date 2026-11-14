import { requireOwner } from "@/lib/auth";
import { formatWhen, labelize } from "@/lib/format";

export const metadata = { title: "Activity" };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireOwner();
  let query = supabase
    .from("activities")
    .select("id, entity_type, entity_id, actor, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (params.actor) query = query.eq("actor", params.actor);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const actors = [...new Set((data ?? []).map((row) => row.actor))];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Activity</h1>
        <p className="text-sm text-muted-foreground">Every write from the hub lands here. Agents should write the same table.</p>
      </div>
      <form className="flex gap-2" action="/activity">
        <select name="actor" defaultValue={params.actor || ""} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Actor">
          <option value="">All actors</option>
          {actors.map((actor) => (
            <option key={actor} value={actor}>
              {actor}
            </option>
          ))}
        </select>
        <button className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground" type="submit">
          Filter
        </button>
      </form>
      <ol className="flex flex-col gap-3">
        {(data ?? []).length === 0 ? <li className="text-sm text-muted-foreground">No activity yet. Actions in the hub will show up here.</li> : null}
        {(data ?? []).map((row) => (
          <li key={row.id} className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">
              {formatWhen(row.created_at)} · {row.actor} · {row.entity_type}
            </p>
            <p className="font-medium">{labelize(row.action)}</p>
            <p className="break-words text-muted-foreground">{JSON.stringify(row.details)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
