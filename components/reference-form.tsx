import {
  createReference,
  updateReference,
} from "@/app/actions/references";
import { REFERENCE_KINDS, type ContentReference } from "@/lib/references";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferenceForm({
  reference,
  niches,
  agents,
}: {
  reference?: ContentReference | null;
  niches: string[];
  agents: string[];
}) {
  const editing = Boolean(reference);
  const action = editing ? updateReference : createReference;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl bg-card/60 p-4 ring-1 ring-foreground/10">
      {editing ? <input type="hidden" name="id" value={reference!.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Title</span>
          <Input name="title" required defaultValue={reference?.title || ""} placeholder="Injury report dump — Week 10" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">URL</span>
          <Input
            name="url"
            type="url"
            required
            defaultValue={reference?.url || ""}
            placeholder="https://…"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Notes for agents</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={reference?.notes || ""}
          placeholder="What to pull from this link, angle to take, what to avoid…"
          className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Kind</span>
          <select
            name="kind"
            defaultValue={reference?.kind || "article"}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {REFERENCE_KINDS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Niche</span>
          <Input
            name="niche"
            list="reference-niches"
            defaultValue={reference?.niche || ""}
            placeholder="Fantasy Football"
          />
          <datalist id="reference-niches">
            {niches.map((niche) => (
              <option key={niche} value={niche} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Tags</span>
          <Input
            name="tags"
            defaultValue={(reference?.tags || []).join(", ")}
            placeholder="injury, chiefs, week-10"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Assigned agents (comma-separated; blank = all content agents)</span>
        <Input
          name="assigned_agents"
          list="reference-agents"
          defaultValue={(reference?.assigned_agents || []).join(", ")}
          placeholder="Grok Bot, Social Content (Grok Bot)"
        />
        <datalist id="reference-agents">
          {agents.map((agent) => (
            <option key={agent} value={agent} />
          ))}
        </datalist>
      </label>

      {editing ? (
        <label className="flex flex-col gap-1.5 text-sm sm:max-w-xs">
          <span className="text-muted-foreground">Status</span>
          <select
            name="active"
            defaultValue={reference?.active === false ? "false" : "true"}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="true">Active — agents can use</option>
            <option value="false">Paused</option>
          </select>
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit">{editing ? "Save changes" : "Add reference"}</Button>
      </div>
    </form>
  );
}
