import { DealBoard } from "@/components/boards";
import { Stat } from "@/components/stat";
import { requireOwner } from "@/lib/auth";
import { OPEN_DEAL_STATUSES } from "@/lib/constants";
import { companyOf, money } from "@/lib/format";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("deals")
    .select("id, service, value, probability, expected_close, status, prospect_id, prospects(company)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const open = rows.filter((row) => OPEN_DEAL_STATUSES.includes(row.status));
  const pipeline = open.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const weighted = open.reduce(
    (sum, row) => sum + (Number(row.value || 0) * Number(row.probability || 0)) / 100,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag a card to change the deal. The company stage follows. Nothing is emailed from this board.
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open pipeline" value={money(pipeline)} />
        <Stat label="Weighted forecast" value={money(weighted)} hint="Value × probability" />
        <Stat label="Deals" value={String(rows.length)} />
      </section>
      <DealBoard
        items={rows.map((row) => ({
          id: row.id,
          column: row.status,
          title: companyOf(row),
          meta: `${row.service} · ${money(row.value)} · ${row.probability}%`,
          href: `/companies/${row.prospect_id}`,
        }))}
      />
    </div>
  );
}
