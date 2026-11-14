import Link from "next/link";
import { deleteView, saveView } from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { INDUSTRIES, PROSPECT_STAGES } from "@/lib/constants";
import { formatWhen, labelize, nyToday } from "@/lib/format";

export const metadata = { title: "Companies" };

const PAGE_SIZE = 40;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    stage: one(params.stage),
    industry: one(params.industry),
    score: one(params.score),
    region: one(params.region),
    followUp: one(params.followUp),
    owner: one(params.owner),
  };
  const page = Math.max(1, Number(one(params.page) || "1"));
  const { supabase } = await requireOwner();
  const today = nyToday();

  let query = supabase
    .from("prospects")
    .select(
      "id, company, contact, city, region, industry, stage, lead_score, deal_owner, next_follow_up_due, proposed_service",
      { count: "exact" },
    )
    .order("company", { ascending: true });

  if (filters.q) {
    const q = filters.q.replace(/[%_,]/g, "");
    query = query.or(`company.ilike.%${q}%,contact.ilike.%${q}%,website.ilike.%${q}%`);
  }
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.industry) query = query.eq("industry", filters.industry);
  if (filters.score) query = query.gte("lead_score", Number(filters.score));
  if (filters.region) {
    const region = filters.region.replace(/[%_,]/g, "");
    query = query.or(`city.ilike.%${region}%,region.ilike.%${region}%`);
  }
  if (filters.followUp === "overdue") query = query.lt("next_follow_up_due", today);
  if (filters.followUp === "today") query = query.eq("next_follow_up_due", today);
  if (filters.followUp === "upcoming") query = query.gt("next_follow_up_due", today);
  if (filters.followUp === "any") query = query.not("next_follow_up_due", "is", null);
  if (filters.owner) query = query.eq("deal_owner", filters.owner);

  const from = (page - 1) * PAGE_SIZE;
  const [{ data, error, count }, { data: views }, { data: owners }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("saved_views").select("id, name, filters").eq("resource", "prospects").order("name"),
    supabase.from("prospects").select("deal_owner").not("deal_owner", "is", null).limit(200),
  ]);
  if (error) throw new Error(error.message);

  const ownerNames = [...new Set((owners ?? []).map((row) => row.deal_owner).filter(Boolean))] as string[];
  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const queryString = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Companies</h1>
          <p className="text-sm text-muted-foreground">{count || 0} prospects. Open a row for contacts, deals, and the timeline.</p>
        </div>
      </div>
      <Flash error={one(params.error)} />
      <div className="flex flex-wrap gap-2">
        {(views ?? []).map((view) => {
          const viewFilters = (view.filters || {}) as Record<string, string>;
          const href = `/companies?${new URLSearchParams(viewFilters).toString()}`;
          return (
            <div key={view.id} className="flex items-center gap-1">
              <Button variant="outline" size="sm" asChild>
                <Link href={href}>{view.name}</Link>
              </Button>
              <form action={deleteView}>
                <input type="hidden" name="id" value={view.id} />
                <Button type="submit" variant="ghost" size="sm" aria-label={`Delete ${view.name}`}>
                  ×
                </Button>
              </form>
            </div>
          );
        })}
      </div>
      <form className="grid gap-2 md:grid-cols-4 xl:grid-cols-8" action="/companies">
        <Input name="q" defaultValue={filters.q} placeholder="Search" aria-label="Search" />
        <Select name="stage" defaultValue={filters.stage} options={PROSPECT_STAGES} label="Stage" />
        <Select name="industry" defaultValue={filters.industry} options={INDUSTRIES} label="Niche" />
        <Input name="score" defaultValue={filters.score} placeholder="Min score" inputMode="decimal" aria-label="Minimum score" />
        <Input name="region" defaultValue={filters.region} placeholder="City or region" aria-label="City or region" />
        <select name="followUp" defaultValue={filters.followUp} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Follow-up">
          <option value="">Any follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="upcoming">Upcoming</option>
          <option value="any">Has a date</option>
        </select>
        <select name="owner" defaultValue={filters.owner} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Owner agent">
          <option value="">Any owner</option>
          {ownerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>
      <form action={saveView} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="resource" value="prospects" />
        <input type="hidden" name="filters" value={JSON.stringify(filters)} />
        <Input name="name" placeholder="Save this view" className="max-w-xs" aria-label="View name" />
        <Button type="submit" variant="outline">
          Save view
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Place</TableHead>
            <TableHead>Follow-up</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/companies/${row.id}`} className="font-medium hover:underline">
                  {row.company}
                </Link>
                <p className="text-xs text-muted-foreground">{row.contact || row.proposed_service}</p>
              </TableCell>
              <TableCell>{row.industry || "—"}</TableCell>
              <TableCell>
                <Badge variant="outline">{labelize(row.stage)}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">{row.lead_score ?? "—"}</TableCell>
              <TableCell>{[row.city, row.region].filter(Boolean).join(", ") || "—"}</TableCell>
              <TableCell>{formatWhen(row.next_follow_up_due)}</TableCell>
              <TableCell>{row.deal_owner || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/companies?${queryString}${queryString ? "&" : ""}page=${page - 1}`}>Previous</Link>
            </Button>
          ) : null}
          {page < pages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/companies?${queryString}${queryString ? "&" : ""}page=${page + 1}`}>Next</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Select({
  name,
  defaultValue,
  options,
  label,
}: {
  name: string;
  defaultValue: string;
  options: readonly string[];
  label: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labelize(option)}
        </option>
      ))}
    </select>
  );
}
