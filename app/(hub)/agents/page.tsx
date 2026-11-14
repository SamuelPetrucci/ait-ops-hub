import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const { supabase } = await requireOwner();
  const staleBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const [agents, tasks, approvals, content, directives] = await Promise.all([
    supabase.from("agents").select("*").order("name"),
    supabase.from("tasks").select("assigned_agent, status").neq("status", "done"),
    supabase.from("approvals").select("requested_by, status").eq("status", "pending"),
    supabase.from("content_queue").select("assigned_agent, status").eq("status", "in_review"),
    supabase.from("agent_directives").select("agent_id, active"),
  ]);
  for (const result of [agents, tasks, approvals, content, directives]) {
    if (result.error) throw new Error(result.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Agents</h1>
        <p className="text-sm text-muted-foreground">Open an agent to edit the directives they read at startup.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(agents.data ?? []).map((agent) => {
          const openTasks = (tasks.data ?? []).filter((task) => task.assigned_agent === agent.name).length;
          const waiting =
            (approvals.data ?? []).filter((row) => row.requested_by === agent.name).length +
            (content.data ?? []).filter((row) => row.assigned_agent === agent.name).length;
          const activeDirectives = (directives.data ?? []).filter(
            (row) => row.agent_id === agent.id && row.active,
          ).length;
          const stale = agent.status === "active" && (!agent.last_active_at || agent.last_active_at < staleBefore);
          return (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="h-full hover:bg-muted/30">
                <CardHeader>
                  <CardTitle>{agent.name}</CardTitle>
                  <CardDescription>
                    {agent.role || "Agent"} · owns {agent.owner_of || "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={agent.status === "active" ? "default" : "outline"}>{agent.status}</Badge>
                    {stale ? <Badge variant="destructive">Stale 48h+</Badge> : null}
                  </div>
                  <p className="text-muted-foreground">Last activity {formatWhen(agent.last_active_at)}</p>
                  <p>
                    {openTasks} open tasks · {waiting} awaiting approval · {activeDirectives} active directives
                  </p>
                  {agent.daily_budget_note ? <p className="text-muted-foreground">{agent.daily_budget_note}</p> : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
