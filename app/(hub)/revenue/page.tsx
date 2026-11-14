import Link from "next/link";
import { recordExpense, recordPayment } from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { SiteLink } from "@/components/site-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { GOAL_DATE, REVENUE_GOAL, REVENUE_STRETCH } from "@/lib/constants";
import { companyOf, daysUntil, formatWhen, money, nestedString, nyToday } from "@/lib/format";

export const metadata = { title: "Revenue" };

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireOwner();
  const [deals, payments, packages, expenses, niches] = await Promise.all([
    supabase
      .from("deals")
      .select("id, service, value, status, prospect_id, prospects(company, website)")
      .order("updated_at", { ascending: false }),
    supabase.from("payments").select("id, deal_id, amount, date, method, status, notes").order("date", { ascending: false }),
    supabase.from("service_packages").select("name, status, monthly_price, price_range, deliverables, mrr").order("monthly_price"),
    supabase.from("expenses").select("id, item, amount, category, vendor, incurred_on").order("incurred_on", { ascending: false }),
    supabase.from("niches").select("name, avg_potential_deal_value, notes").order("name"),
  ]);
  for (const result of [deals, payments, packages, expenses, niches]) {
    if (result.error) throw new Error(result.error.message);
  }

  const won = (deals.data ?? []).filter((deal) => deal.status === "won");
  const collected = (payments.data ?? [])
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const spent = (expenses.data ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const pct = Math.min(100, Math.round((collected / REVENUE_GOAL) * 100));
  const left = daysUntil(GOAL_DATE, nyToday());
  const dealName = new Map(
    (deals.data ?? []).map((deal) => [deal.id, `${companyOf(deal)} · ${deal.service}`]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Revenue</h1>
        <p className="text-sm text-muted-foreground">
          Goal {money(REVENUE_GOAL)} by Nov 24, stretch {money(REVENUE_STRETCH)}. {left} days left. Recording a payment does not invoice anyone.
        </p>
      </div>
      <Flash error={params.error} />
      <Card>
        <CardHeader>
          <CardTitle>{money(collected)} collected</CardTitle>
          <CardDescription>
            {pct}% of {money(REVENUE_GOAL)}. Expenses recorded {money(spent)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Won deals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {won.length === 0 ? <p className="text-muted-foreground">No won deals yet.</p> : null}
            {won.map((deal) => (
              <div key={deal.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/companies/${deal.prospect_id}`} className="hover:underline">
                  {companyOf(deal)} · {deal.service} · {money(deal.value)}
                </Link>
                <SiteLink website={nestedString(deal.prospects, "website")} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Record a payment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordPayment} className="grid gap-2">
              <select name="deal_id" required className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Deal">
                <option value="">Deal</option>
                {(deals.data ?? []).map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {companyOf(deal)} · {deal.service}
                  </option>
                ))}
              </select>
              <Input name="amount" inputMode="decimal" required placeholder="Amount" aria-label="Amount" />
              <Input name="date" type="date" defaultValue={nyToday()} aria-label="Date" />
              <Input name="method" placeholder="Method (ach, card, check)" aria-label="Method" />
              <select name="status" defaultValue="paid" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Status">
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
              <Button type="submit">Save payment</Button>
            </form>
          </CardContent>
        </Card>
      </section>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(payments.data ?? []).map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>{formatWhen(payment.date)}</TableCell>
              <TableCell>{dealName.get(payment.deal_id) || payment.deal_id}</TableCell>
              <TableCell>{money(payment.amount)}</TableCell>
              <TableCell>{payment.method || "—"}</TableCell>
              <TableCell>{payment.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service packages</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {(packages.data ?? []).map((item) => (
              <div key={item.name}>
                <p className="font-medium">
                  {item.name} · {item.price_range || money(item.monthly_price)}
                </p>
                <p className="text-muted-foreground">{item.deliverables}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Niches: {(niches.data ?? []).map((niche) => niche.name).join(", ") || "none"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(expenses.data ?? []).map((expense) => (
              <p key={expense.id} className="text-sm">
                {expense.item} · {money(expense.amount)} · {expense.category || "uncategorized"}
              </p>
            ))}
            <form action={recordExpense} className="grid gap-2">
              <Input name="item" required placeholder="Item" aria-label="Item" />
              <Input name="amount" required inputMode="decimal" placeholder="Amount" aria-label="Expense amount" />
              <select name="category" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Category">
                <option value="software">Software</option>
                <option value="ads">Ads</option>
                <option value="fees">Fees</option>
                <option value="other">Other</option>
              </select>
              <Input name="vendor" placeholder="Vendor" aria-label="Vendor" />
              <Input name="incurred_on" type="date" defaultValue={nyToday()} aria-label="Incurred on" />
              <Button type="submit" variant="outline">
                Add expense
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
