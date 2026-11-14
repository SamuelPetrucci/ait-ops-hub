import Link from "next/link";
import { notFound } from "next/navigation";
import { addDirective, reorderDirective, setAgentStatus, updateDirective } from "@/app/actions/mutations";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireOwner } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Agent" };

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireOwner();
  const { data: agent, error } = await supabase.from("agents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!agent) notFound();
  const { data: directives, error: directiveError } = await supabase
    .from("agent_directives")
    .select("*")
    .eq("agent_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (directiveError) throw new Error(directiveError.message);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/agents" className="hover:underline">
            Agents
          </Link>
        </p>
        <h1 className="text-2xl font-medium">{agent.name}</h1>
        <p className="text-sm text-muted-foreground">
          {agent.role} · {agent.owner_of} · last active {formatWhen(agent.last_active_at)}
        </p>
      </div>
      <Flash error={query.error} />
      <form action={setAgentStatus} className="flex items-center gap-2">
        <input type="hidden" name="id" value={agent.id} />
        <input type="hidden" name="status" value={agent.status === "active" ? "paused" : "active"} />
        <Badge>{agent.status}</Badge>
        <Button type="submit" variant="outline" size="sm">
          {agent.status === "active" ? "Pause" : "Resume"}
        </Button>
      </form>
      <div className="flex flex-col gap-3">
        {(directives ?? []).map((directive, index) => (
          <Card key={directive.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                #{index + 1} · {directive.priority} · {directive.active ? "active" : "paused"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateDirective} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={directive.id} />
                <input type="hidden" name="agent_id" value={agent.id} />
                <Textarea name="directive" defaultValue={directive.directive} required aria-label="Directive" />
                <div className="flex flex-wrap items-center gap-2">
                  <select name="priority" defaultValue={directive.priority} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Priority">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="active" defaultChecked={directive.active} />
                    Active
                  </label>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
              <div className="mt-2 flex gap-2">
                <form action={reorderDirective}>
                  <input type="hidden" name="id" value={directive.id} />
                  <input type="hidden" name="agent_id" value={agent.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button type="submit" size="sm" variant="outline">
                    Up
                  </Button>
                </form>
                <form action={reorderDirective}>
                  <input type="hidden" name="id" value={directive.id} />
                  <input type="hidden" name="agent_id" value={agent.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button type="submit" size="sm" variant="outline">
                    Down
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New directive</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addDirective} className="flex flex-col gap-2">
            <input type="hidden" name="agent_id" value={agent.id} />
            <Textarea name="directive" required placeholder="What this agent should do at startup" aria-label="New directive" />
            <select name="priority" defaultValue="medium" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Priority">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button type="submit">Add directive</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
