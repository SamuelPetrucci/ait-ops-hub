import Link from "next/link";
import { deleteView, saveView } from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { ProspectScoreSelect } from "@/components/prospect-score-select";
import { ProspectStageSelect } from "@/components/prospect-stage-select";
import { SiteLink } from "@/components/site-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import {
  crmHref,
  crmSearchParams,
  filterStagesForScope,
  parseCrmFilters,
  stageLabel,
  stagesForScope,
  type ProspectScope,
} from "@/lib/crm";
import { formatWhen, nyToday } from "@/lib/format";
import { applyProspectFilters } from "@/lib/prospects";

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
}: {
  scope: ProspectScope;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseCrmFilters(searchParams);
  const page = Math.max(1, Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page) || 1);
  const { supabase } = await requireOwner();
  const today = nyToday();
  const base = "/crm";
  const clearHref = crmHref({ scope, view: "list" });
  const openStages = stagesForScope(scope, filters.includeDnc === "1");
  const pipelineStages = filterStagesForScope(scope);

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

  const [{ data, error, count }, { data: views }, { data: facetRows }, { data: stageFacetRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1) as Promise<{
      data: ProspectRow[] | null;
      error: { message: string } | null;
      count: number | null;
    }>,
    supabase.from("saved_views").select("id, name, filters").eq("resource", "prospects").order("name"),
    supabase
      .from("prospects")
      .select("stage, industry, deal_owner, lead_score, next_follow_up_due")
      .in("stage", openStages),
    supabase.from("prospects").select("stage").in("stage", pipelineStages),
  ]);
  if (error) throw new Error(error.message);

  const stageCounts = new Map<string, number>();
  for (const row of stageFacetRows ?? []) {
    stageCounts.set(row.stage, (stageCounts.get(row.stage) || 0) + 1);
  }

  const industryCounts = new Map<string, number>();
  const ownerCounts = new Map<string, number>();
  let dueCount = 0;
  let overdueCount = 0;
  let scoredHot = 0;
  for (const row of facetRows ?? []) {
    if (row.industry) industryCounts.set(row.industry, (industryCounts.get(row.industry) || 0) + 1);
    if (row.deal_owner) ownerCounts.set(row.deal_owner, (ownerCounts.get(row.deal_owner) || 0) + 1);
    if (row.next_follow_up_due) {
      if (row.next_follow_up_due <= today) dueCount += 1;
      if (row.next_follow_up_due < today) overdueCount += 1;
    }
    if (Number(row.lead_score) >= 50) scoredHot += 1;
  }
  const industryOptions = [...industryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  const ownerOptions = [...ownerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const hasFilters = Object.values(filters).some(Boolean);
  const errorMessage = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;
  const chipHref = (partial: Partial<typeof filters>) =>
    crmHref({ scope, view: "list", filters: { ...filters, ...partial } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">{count || 0}</span>{" "}
          {(count || 0) === 1 ? "record" : "records"}
        </p>
        {hasFilters ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        ) : null}
      </div>

      <Flash error={errorMessage} />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <QuickChip href={clearHref} active={!hasFilters} label="All" count={facetRows?.length || 0} />
        <QuickChip
          href={chipHref({ followUp: "due", stage: "", stageGroup: "", score: "" })}
          active={filters.followUp === "due" && !filters.stage}
          label="Needs follow-up"
          count={dueCount}
        />
        <QuickChip
          href={chipHref({ followUp: "overdue", stage: "", stageGroup: "", score: "" })}
          active={filters.followUp === "overdue" && !filters.stage}
          label="Overdue"
          count={overdueCount}
        />
        <QuickChip
          href={chipHref({ score: "50", followUp: "", stage: "", stageGroup: "" })}
          active={filters.score === "50" && !filters.stage}
          label="Score 50+"
          count={scoredHot}
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Pipeline stages">
        {pipelineStages.map((stage) => (
          <QuickChip
            key={stage}
            href={chipHref({ stage, stageGroup: "", followUp: "", score: "" })}
            active={filters.stage === stage}
            label={stageLabel(stage)}
            count={stageCounts.get(stage) || 0}
          />
        ))}
      </div>

      {(views ?? []).length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(views ?? []).map((view) => {
            const viewFilters = (view.filters || {}) as Record<string, string>;
            const href = crmHref({
              scope,
              view: "list",
              filters: {
                q: viewFilters.q || "",
                stage: viewFilters.stage || "",
                stageGroup: viewFilters.stageGroup || "",
                industry: viewFilters.industry || "",
                score: viewFilters.score || "",
                followUp: viewFilters.followUp || "",
                owner: viewFilters.owner || "",
                includeDnc: viewFilters.includeDnc || "",
                town: viewFilters.town || "",
                routeId: viewFilters.routeId || "",
                maxDistance: viewFilters.maxDistance || "",
              },
            });
            return (
              <div key={view.id} className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href={href}>{view.name}</Link>
                </Button>
                <form action={deleteView}>
                  <input type="hidden" name="id" value={view.id} />
                  <input type="hidden" name="return_to" value={crmHref({ scope })} />
                  <Button type="submit" variant="ghost" size="sm" aria-label={`Delete ${view.name}`}>
                    ×
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      ) : null}

      <form method="get" action={base} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {scope !== "leads" ? <input type="hidden" name="scope" value={scope} /> : null}
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Search"
          aria-label="Search"
          className="col-span-2 sm:col-span-1"
        />
        <select
          name="stage"
          defaultValue={filters.stage}
          aria-label="Pipeline stage"
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All pipeline stages</option>
          {pipelineStages.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabel(stage)} ({stageCounts.get(stage) || 0})
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
        ) : null}
        {scope === "leads" || scope === "all" ? (
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground sm:col-span-1">
            <input type="checkbox" name="includeDnc" value="1" defaultChecked={filters.includeDnc === "1"} />
            Include DNC
          </label>
        ) : null}
        <Button type="submit" className="col-span-2 sm:col-span-1">
          Apply
        </Button>
      </form>

      <form action={saveView} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="resource" value="prospects" />
        <input type="hidden" name="filters" value={JSON.stringify(filters)} />
        <input type="hidden" name="return_to" value={crmHref({ scope })} />
        <Input name="name" placeholder="Save this view" className="max-w-xs" aria-label="View name" />
        <Button type="submit" variant="outline">
          Save view
        </Button>
      </form>

      {(data ?? []).length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {scope === "clients"
            ? "No clients yet. Move a company to audit paid, won, or delivered."
            : "No records match these filters."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Site</TableHead>
                <TableHead className="hidden md:table-cell">Niche</TableHead>
                <TableHead className="hidden sm:table-cell">Score</TableHead>
                <TableHead className="hidden lg:table-cell">Follow-up</TableHead>
                {ownerOptions.length > 0 ? <TableHead className="hidden xl:table-cell">Owner</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[9rem] max-w-[14rem]">
                    <Link href={`/companies/${row.id}`} className="font-medium hover:underline">
                      {row.company}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:hidden">
                      <SiteLink website={row.website} className="w-fit text-xs text-primary hover:underline" />
                      {row.industry ? <span className="text-xs text-muted-foreground">{row.industry}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <ProspectStageSelect id={row.id} stage={row.stage} compact />
                  </TableCell>
                  <TableCell className="hidden align-top sm:table-cell">
                    <SiteLink website={row.website} className="text-sm text-primary hover:underline" />
                    {!row.website ? <span className="text-sm text-muted-foreground">—</span> : null}
                  </TableCell>
                  <TableCell className="hidden align-top md:table-cell">{row.industry || "—"}</TableCell>
                  <TableCell className="hidden align-top sm:table-cell">
                    <ProspectScoreSelect id={row.id} score={row.lead_score} compact />
                  </TableCell>
                  <TableCell className="hidden align-top lg:table-cell">
                    <span className={row.next_follow_up_due && row.next_follow_up_due < today ? "text-amber-600" : ""}>
                      {formatWhen(row.next_follow_up_due)}
                    </span>
                  </TableCell>
                  {ownerOptions.length > 0 ? (
                    <TableCell className="hidden align-top xl:table-cell">{row.deal_owner || "—"}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/crm?${crmSearchParams({ scope, view: "list", filters, page: page - 1 })}`}>
                Previous
              </Link>
            </Button>
          ) : null}
          {page < pages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/crm?${crmSearchParams({ scope, view: "list", filters, page: page + 1 })}`}>Next</Link>
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
