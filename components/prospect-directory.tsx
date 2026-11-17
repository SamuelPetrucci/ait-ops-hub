import Link from "next/link";
import { deleteView, saveView } from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { ProspectStageSelect } from "@/components/prospect-stage-select";
import { SiteLink } from "@/components/site-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { formatWhen, nyToday } from "@/lib/format";
import {
  applyProspectFilters,
  filtersToSearchParams,
  listBasePath,
  parseProspectFilters,
  SCOPE_STAGES,
  type ProspectScope,
} from "@/lib/prospects";
import {
  getProspectGroupFromStage,
  getProspectGroupLabel,
  PROSPECT_GROUP_ORDER,
  type ProspectStageGroup,
} from "@/lib/status-groups";

const PAGE_SIZE = 40;

type ProspectRow = {
  id: string;
  company: string;
  contact: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
  stage: string;
  lead_score: number | null;
  deal_owner: string | null;
  next_follow_up_due: string | null;
  proposed_service: string | null;
};

const FOLLOW_UP_OPTIONS = [
  { value: "", label: "Any follow-up" },
  { value: "due", label: "Due or overdue" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "any", label: "Has a date" },
] as const;

export async function ProspectDirectory({
  scope,
  searchParams,
  title,
  description,
}: {
  scope: ProspectScope;
  searchParams: Record<string, string | string[] | undefined>;
  title: string;
  description: string;
}) {
  const filters = parseProspectFilters(searchParams);
  const page = Math.max(1, Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page) || 1);
  const { supabase } = await requireOwner();
  const today = nyToday();
  const base = listBasePath(scope);
  const allowedStages = SCOPE_STAGES[scope];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase builder typing blows up with chained filters
  let query: any = supabase
    .from("prospects")
    .select(
      "id, company, contact, website, city, region, industry, stage, lead_score, deal_owner, next_follow_up_due, proposed_service",
      { count: "exact" },
    )
    .order("company", { ascending: true });

  query = applyProspectFilters(query, scope, filters, today);

  const from = (page - 1) * PAGE_SIZE;
  const scopeStages = scope === "leads" && filters.includeDnc === "1" ? [...allowedStages, "do_not_contact"] : [...allowedStages];

  const [{ data, error, count }, { data: views }, { data: facetRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1) as Promise<{
      data: ProspectRow[] | null;
      error: { message: string } | null;
      count: number | null;
    }>,
    supabase.from("saved_views").select("id, name, filters").eq("resource", "prospects").order("name"),
    supabase.from("prospects").select("stage, industry, deal_owner, lead_score, next_follow_up_due").in("stage", scopeStages),
  ]);
  if (error) throw new Error(error.message);

  const stageCounts = new Map<string, number>();
  const groupCounts = new Map<ProspectStageGroup, number>();
  const industryCounts = new Map<string, number>();
  const ownerCounts = new Map<string, number>();
  let dueCount = 0;
  let overdueCount = 0;
  let scoredHot = 0;
  for (const row of facetRows ?? []) {
    stageCounts.set(row.stage, (stageCounts.get(row.stage) || 0) + 1);
    const group = getProspectGroupFromStage(row.stage);
    groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    if (row.industry) industryCounts.set(row.industry, (industryCounts.get(row.industry) || 0) + 1);
    if (row.deal_owner) ownerCounts.set(row.deal_owner, (ownerCounts.get(row.deal_owner) || 0) + 1);
    if (row.next_follow_up_due) {
      if (row.next_follow_up_due <= today) dueCount += 1;
      if (row.next_follow_up_due < today) overdueCount += 1;
    }
    if (Number(row.lead_score) >= 50) scoredHot += 1;
  }

  const stageOptions = allowedStages.filter((stage) => (stageCounts.get(stage) || 0) > 0 || filters.stage === stage);
  const groupOptions = PROSPECT_GROUP_ORDER.filter((group) => (groupCounts.get(group) || 0) > 0 || filters.stageGroup === group);
  const currentStageGroup = filters.stage ? getProspectGroupFromStage(filters.stage) : filters.stageGroup;
  const industryOptions = [...industryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  const ownerOptions = [...ownerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const queryString = filtersToSearchParams(filters);
  const hasFilters = Object.values(filters).some(Boolean);
  const errorMessage = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count || 0} {count === 1 ? "record" : "records"}. {description}
          </p>
        </div>
        {hasFilters ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={base}>Clear filters</Link>
          </Button>
        ) : null}
      </div>

      <Flash error={errorMessage} />

      <div className="flex flex-wrap gap-2">
        <QuickChip href={base} active={!hasFilters} label="All" count={facetRows?.length || 0} />
        <QuickChip
          href={`${base}?${filtersToSearchParams({ ...filters, followUp: "due", stage: "", stageGroup: "", score: "" })}`}
          active={filters.followUp === "due"}
          label="Needs follow-up"
          count={dueCount}
        />
        <QuickChip
          href={`${base}?${filtersToSearchParams({ ...filters, followUp: "overdue", stage: "", stageGroup: "", score: "" })}`}
          active={filters.followUp === "overdue"}
          label="Overdue"
          count={overdueCount}
        />
        <QuickChip
          href={`${base}?${filtersToSearchParams({ ...filters, score: "50", followUp: "", stage: "", stageGroup: "" })}`}
          active={filters.score === "50"}
          label="Score 50+"
          count={scoredHot}
        />
        {groupOptions.map((group) => (
          <QuickChip
            key={group}
            href={`${base}?${filtersToSearchParams({ ...filters, stageGroup: group, stage: "", followUp: "", score: "" })}`}
            active={currentStageGroup === group && !filters.stage}
            label={getProspectGroupLabel(group)}
            count={groupCounts.get(group) || 0}
          />
        ))}
      </div>

      {(views ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(views ?? []).map((view) => {
            const viewFilters = (view.filters || {}) as Record<string, string>;
            const href = `${base}?${new URLSearchParams(viewFilters).toString()}`;
            return (
              <div key={view.id} className="flex items-center gap-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href={href}>{view.name}</Link>
                </Button>
                <form action={deleteView}>
                  <input type="hidden" name="id" value={view.id} />
                  <input type="hidden" name="return_to" value={base} />
                  <Button type="submit" variant="ghost" size="sm" aria-label={`Delete ${view.name}`}>
                    ×
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      ) : null}

      <form method="get" action={base} className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Input name="q" defaultValue={filters.q} placeholder="Search company, contact, site" aria-label="Search" />
        <select
          name="stageGroup"
          defaultValue={filters.stageGroup || (filters.stage ? getProspectGroupFromStage(filters.stage) : "")}
          aria-label="Stage"
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All stages</option>
          {groupOptions.map((group) => (
            <option key={group} value={group}>
              {getProspectGroupLabel(group)} ({groupCounts.get(group) || 0})
            </option>
          ))}
        </select>
        <select
          name="industry"
          defaultValue={filters.industry}
          aria-label="Niche"
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All niches</option>
          {industryOptions.map((industry) => (
            <option key={industry} value={industry}>
              {industry} ({industryCounts.get(industry) || 0})
            </option>
          ))}
        </select>
        <Input
          name="score"
          defaultValue={filters.score}
          placeholder="Min score"
          inputMode="decimal"
          aria-label="Minimum score"
        />
        <select
          name="followUp"
          defaultValue={filters.followUp}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          aria-label="Follow-up"
        >
          {FOLLOW_UP_OPTIONS.map((option) => (
            <option key={option.value || "any-empty"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {ownerOptions.length > 0 ? (
          <select
            name="owner"
            defaultValue={filters.owner}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            aria-label="Owner"
          >
            <option value="">Any owner</option>
            {ownerOptions.map((name) => (
              <option key={name} value={name}>
                {name} ({ownerCounts.get(name) || 0})
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden xl:block" />
        )}
        {scope === "leads" ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
            <input type="checkbox" name="includeDnc" value="1" defaultChecked={filters.includeDnc === "1"} />
            Include do-not-contact
          </label>
        ) : null}
        <Button type="submit" className="md:col-span-1">
          Apply filters
        </Button>
      </form>

      <form action={saveView} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="resource" value="prospects" />
        <input type="hidden" name="filters" value={JSON.stringify(filters)} />
        <input type="hidden" name="return_to" value={base} />
        <Input name="name" placeholder="Save this view" className="max-w-xs" aria-label="View name" />
        <Button type="submit" variant="outline">
          Save view
        </Button>
      </form>

      {(data ?? []).length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {scope === "clients"
            ? "No clients yet. Companies move here when a deal is won, paid, or delivered."
            : "No leads match these filters."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Follow-up</TableHead>
              {ownerOptions.length > 0 ? <TableHead>Owner</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/companies/${row.id}`} className="font-medium hover:underline">
                    {row.company}
                  </Link>
                  <SiteLink website={row.website} className="block w-fit text-xs text-primary hover:underline" />
                  <p className="text-xs text-muted-foreground">{row.contact || row.proposed_service}</p>
                </TableCell>
                <TableCell>{row.industry || "—"}</TableCell>
                <TableCell>
                  <ProspectStageSelect id={row.id} stage={row.stage} compact />
                </TableCell>
                <TableCell className="tabular-nums">{row.lead_score ?? "—"}</TableCell>
                <TableCell>
                  <span className={row.next_follow_up_due && row.next_follow_up_due < today ? "text-amber-600" : ""}>
                    {formatWhen(row.next_follow_up_due)}
                  </span>
                </TableCell>
                {ownerOptions.length > 0 ? <TableCell>{row.deal_owner || "—"}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${base}?${filtersToSearchParams(filters, page - 1)}`}>Previous</Link>
            </Button>
          ) : null}
          {page < pages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${base}?${filtersToSearchParams(filters, page + 1)}`}>Next</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuickChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-1 text-xs ring-1 ring-foreground/10 ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      {label} <span className="tabular-nums">{count}</span>
    </Link>
  );
}
