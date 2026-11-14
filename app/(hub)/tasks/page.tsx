import Link from "next/link";
import { createTask } from "@/app/actions/mutations";
import { TaskBoard } from "@/components/boards";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireOwner } from "@/lib/auth";
import { formatWhen, nestedString } from "@/lib/format";

export const metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireOwner();
  const [{ data, error }, { data: agents }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, assigned_agent, status, priority, due_date, prospect_id, content_id, prospects(company)")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("agents").select("name").order("name"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Tasks</h1>
        <p className="text-sm text-muted-foreground">One board across every agent. Drag a card to change its status.</p>
      </div>
      <Flash error={params.error} />
      <form action={createTask} className="grid gap-2 md:grid-cols-6">
        <input type="hidden" name="return_to" value="/tasks" />
        <Input name="title" required placeholder="Task" className="md:col-span-2" aria-label="Title" />
        <select name="assigned_agent" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Assignee">
          <option value="">Assignee</option>
          {(agents ?? []).map((agent) => (
            <option key={agent.name} value={agent.name}>
              {agent.name}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue="medium" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Priority">
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <Input name="due_date" type="date" aria-label="Due date" />
        <Button type="submit">Add</Button>
      </form>
      <TaskBoard
        items={(data ?? []).map((task) => {
          const company = nestedString(task.prospects, "company");
          return {
            id: task.id,
            column: task.status,
            title: task.title,
            meta: [task.assigned_agent, task.priority, formatWhen(task.due_date), company].filter(Boolean).join(" · "),
            href: task.prospect_id ? `/companies/${task.prospect_id}` : task.content_id ? "/content" : undefined,
          };
        })}
      />
      <p className="text-xs text-muted-foreground">
        Company links open the company. Content-linked tasks open the <Link href="/content" className="underline">content engine</Link>.
      </p>
    </div>
  );
}
