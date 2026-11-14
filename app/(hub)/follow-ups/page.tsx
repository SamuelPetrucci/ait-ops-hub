import Link from "next/link";
import { completeFollowUp, snoozeFollowUp } from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth";
import { formatWhen, nyToday } from "@/lib/format";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireOwner();
  const today = nyToday();
  const { data, error } = await supabase
    .from("prospects")
    .select("id, company, next_follow_up_due, stage, deal_owner")
    .not("next_follow_up_due", "is", null)
    .order("next_follow_up_due", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const groups = {
    Overdue: rows.filter((row) => row.next_follow_up_due < today),
    Today: rows.filter((row) => row.next_follow_up_due === today),
    Upcoming: rows.filter((row) => row.next_follow_up_due > today),
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Snooze moves the date. Complete clears it and writes an activity.</p>
      </div>
      <Flash error={params.error} />
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(groups).map(([label, items]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>
                {label} <span className="text-muted-foreground">{items.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {items.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : null}
              {items.map((row) => (
                <div key={row.id} className="rounded-lg bg-muted/40 p-2 text-sm">
                  <Link href={`/companies/${row.id}`} className="font-medium hover:underline">
                    {row.company}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(row.next_follow_up_due)} · {row.deal_owner || "Unassigned"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <form action={snoozeFollowUp}>
                      <input type="hidden" name="prospect_id" value={row.id} />
                      <input type="hidden" name="current" value={row.next_follow_up_due || ""} />
                      <input type="hidden" name="days" value="1" />
                      <Button type="submit" size="sm" variant="outline">
                        Snooze 1d
                      </Button>
                    </form>
                    <form action={snoozeFollowUp}>
                      <input type="hidden" name="prospect_id" value={row.id} />
                      <input type="hidden" name="current" value={row.next_follow_up_due || ""} />
                      <input type="hidden" name="days" value="7" />
                      <Button type="submit" size="sm" variant="outline">
                        Snooze 7d
                      </Button>
                    </form>
                    <form action={completeFollowUp}>
                      <input type="hidden" name="prospect_id" value={row.id} />
                      <Button type="submit" size="sm">
                        Complete
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
