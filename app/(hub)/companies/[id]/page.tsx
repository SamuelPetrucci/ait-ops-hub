import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createContact,
  createDeal,
  createTask,
  draftOutreach,
  logTouch,
  scheduleFollowUp,
} from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { SiteLink } from "@/components/site-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireOwner } from "@/lib/auth";
import { DEAL_COLUMNS } from "@/lib/constants";
import { formatWhen, labelize, money, siteUrl } from "@/lib/format";

export const metadata = { title: "Company" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Event = { at: string; kind: string; title: string; body: string; actor: string };

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireOwner();

  const { data: company, error } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!company) notFound();

  const [contacts, deals, outreach, tasks, approvals, agents, activities] = await Promise.all([
    supabase.from("contacts").select("*").eq("prospect_id", id).order("is_primary", { ascending: false }),
    supabase.from("deals").select("*").eq("prospect_id", id).order("updated_at", { ascending: false }),
    supabase.from("outreach_messages").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
    supabase.from("approvals").select("*").eq("related_prospect_id", id).order("created_at", { ascending: false }),
    supabase.from("agents").select("name").order("name"),
    supabase
      .from("activities")
      .select("*")
      .eq("entity_type", "prospect")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  for (const result of [contacts, deals, outreach, tasks, approvals, agents, activities]) {
    if (result.error) throw new Error(result.error.message);
  }

  const dealIds = (deals.data ?? []).map((deal) => deal.id);
  const dealActivities = dealIds.length
    ? await supabase
        .from("activities")
        .select("*")
        .eq("entity_type", "deal")
        .in("entity_id", dealIds)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [], error: null };
  if (dealActivities.error) throw new Error(dealActivities.error.message);

  const events: Event[] = [
    ...(outreach.data ?? []).map((row) => ({
      at: row.sent_at || row.created_at,
      kind: "Outreach",
      title: row.subject || `${labelize(row.status)} ${row.channel}`,
      body: row.body || row.review_notes || "",
      actor: row.approved_by || "agent",
    })),
    ...(tasks.data ?? []).map((row) => ({
      at: row.created_at,
      kind: "Task",
      title: row.title,
      body: [row.assigned_agent, labelize(row.status), row.due_date].filter(Boolean).join(" · "),
      actor: row.assigned_agent || "Samuel",
    })),
    ...(approvals.data ?? []).map((row) => ({
      at: row.reviewed_at || row.created_at,
      kind: "Approval",
      title: row.title,
      body: row.review_notes || row.notes || "",
      actor: row.approved_by || row.requested_by || "Samuel",
    })),
    ...(activities.data ?? []).map((row) => ({
      at: row.created_at,
      kind: labelize(row.action),
      title: labelize(row.action),
      body: typeof row.details?.body === "string" ? row.details.body : JSON.stringify(row.details ?? {}),
      actor: row.actor,
    })),
    ...(dealActivities.data ?? [])
      .filter((row) => row.action === "status_change" || row.action === "payment")
      .map((row) => ({
        at: row.created_at,
        kind: "Deal",
        title: labelize(row.action),
        body: JSON.stringify(row.details ?? {}),
        actor: row.actor,
      })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/companies" className="hover:underline">
              Companies
            </Link>
          </p>
          <h1 className="text-2xl font-medium">{company.company}</h1>
          <p className="text-sm text-muted-foreground">
            {[company.industry, company.city, company.region].filter(Boolean).join(" · ") || "No location yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {siteUrl(company.website) ? (
            <Button variant="outline" size="sm" asChild>
              <a href={siteUrl(company.website) || undefined} target="_blank" rel="noreferrer">
                Visit site
              </a>
            </Button>
          ) : null}
          <Badge>{labelize(company.stage)}</Badge>
          <Badge variant="outline">Follow-up {formatWhen(company.next_follow_up_due)}</Badge>
        </div>
      </div>
      <Flash error={query.error} />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                <SiteLink website={company.website} className="text-sm text-primary hover:underline" />
                {siteUrl(company.website) ? null : "No website"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="Contact string" value={company.contact} />
              <Field label="Service" value={company.proposed_service} />
              <Field label="Score" value={company.lead_score} />
              <Field label="Owner" value={company.deal_owner} />
              <Field label="Opportunity" value={company.primary_opportunity} />
              <Field label="Angle" value={company.outreach_angle} />
              <div className="sm:col-span-2">
                <Field label="Notes" value={company.notes} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(contacts.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No people yet.</p>
              ) : (
                (contacts.data ?? []).map((contact) => (
                  <div key={contact.id} className="text-sm">
                    <p className="font-medium">
                      {contact.name} {contact.is_primary ? <Badge variant="outline">Primary</Badge> : null}
                    </p>
                    <p className="text-muted-foreground">
                      {[contact.title, contact.email, contact.phone].filter(Boolean).join(" · ") || contact.notes}
                    </p>
                  </div>
                ))
              )}
              <form action={createContact} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="prospect_id" value={id} />
                <Input name="name" placeholder="Name" required aria-label="Contact name" />
                <Input name="email" placeholder="Email" type="email" aria-label="Contact email" />
                <Input name="phone" placeholder="Phone" aria-label="Contact phone" />
                <Input name="title" placeholder="Title" aria-label="Contact title" />
                <Button type="submit" className="sm:col-span-2">
                  Add contact
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Deals</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(deals.data ?? []).map((deal) => (
                <div key={deal.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{deal.service}</p>
                    <p className="text-muted-foreground">
                      {labelize(deal.status)} · {money(deal.value)} · {deal.probability}% · close {formatWhen(deal.expected_close)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/pipeline">Pipeline</Link>
                  </Button>
                </div>
              ))}
              <form action={createDeal} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="prospect_id" value={id} />
                <Input name="service" placeholder="Service" required defaultValue={company.proposed_service || ""} aria-label="Service" />
                <Input name="value" placeholder="Value" inputMode="decimal" aria-label="Value" />
                <Input name="probability" placeholder="Probability" defaultValue="20" inputMode="numeric" aria-label="Probability" />
                <Input name="expected_close" type="date" aria-label="Expected close" />
                <select name="status" defaultValue="researched" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Deal status">
                  {DEAL_COLUMNS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button type="submit">Add deal</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Outreach, notes, tasks, approvals, and status changes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {events.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
              {events.slice(0, 40).map((event, index) => (
                <article key={`${event.at}-${index}`} className="border-l border-border pl-3">
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(event.at)} · {event.kind} · {event.actor}
                  </p>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.body ? <p className="text-sm whitespace-pre-wrap text-muted-foreground">{event.body}</p> : null}
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form action={logTouch} className="flex flex-col gap-2">
                <input type="hidden" name="prospect_id" value={id} />
                <Textarea name="body" placeholder="Call or note" required aria-label="Note" />
                <div className="flex gap-2">
                  <Button type="submit" name="kind" value="note" variant="outline">
                    Log note
                  </Button>
                  <Button type="submit" name="kind" value="call">
                    Log call
                  </Button>
                </div>
              </form>
              <form action={scheduleFollowUp} className="flex items-center gap-2">
                <input type="hidden" name="prospect_id" value={id} />
                <Input name="date" type="date" required aria-label="Follow-up date" defaultValue={company.next_follow_up_due || ""} />
                <Button type="submit" variant="outline">
                  Schedule
                </Button>
              </form>
              <form action={createTask} className="flex flex-col gap-2">
                <input type="hidden" name="prospect_id" value={id} />
                <input type="hidden" name="return_to" value={`/companies/${id}`} />
                <Input name="title" placeholder="Task" required aria-label="Task title" />
                <select name="assigned_agent" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Assignee">
                  <option value="">Unassigned</option>
                  {(agents.data ?? []).map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <select name="priority" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Priority">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <Input name="due_date" type="date" aria-label="Due date" />
                <Button type="submit" variant="outline">
                  Create task
                </Button>
              </form>
              <form action={draftOutreach} className="flex flex-col gap-2">
                <input type="hidden" name="prospect_id" value={id} />
                <Input name="subject" placeholder="Subject" required aria-label="Subject" />
                <Textarea name="body" placeholder="Draft. This does not send." required aria-label="Draft" />
                <Button type="submit">Draft for approval</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}. </span>
      {value == null || value === "" ? "—" : String(value)}
    </p>
  );
}
