import type { ReactNode } from "react";
import Link from "next/link";
import { reviewApproval, reviewContent, reviewOutreach } from "@/app/actions/mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireOwner } from "@/lib/auth";
import { byContentRecency } from "@/lib/content";
import { formatWhen, nestedString } from "@/lib/format";

export const metadata = { title: "Approvals" };

type QueueItem = {
  key: string;
  kind: string;
  title: string;
  createdAt: string;
  body: ReactNode;
  form: ReactNode;
};

export default async function ApprovalsPage() {
  const { supabase } = await requireOwner();
  const [approvals, outreach, content] = await Promise.all([
    supabase.from("approvals").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    supabase
      .from("outreach_messages")
      .select("id, prospect_id, subject, body, status, created_at, prospects(company)")
      .in("status", ["pending_approval", "held"])
      .order("created_at", { ascending: false }),
    supabase
      .from("content_queue")
      .select("id, title, status, caption, video_url, script_json, source_urls, platforms, created_at, updated_at, posted_at, scheduled_at, content_id")
      .eq("status", "in_review")
      .order("updated_at", { ascending: false }),
  ]);
  for (const result of [approvals, outreach, content]) {
    if (result.error) throw new Error(result.error.message);
  }

  const items: QueueItem[] = [
    ...(approvals.data ?? []).map((row) => ({
      key: `approval-${row.id}`,
      kind: row.type || "Approval",
      title: row.title,
      createdAt: row.created_at,
      body: (
        <div className="text-sm">
          <p className="text-muted-foreground">Requested by {row.requested_by || "unknown"}</p>
          <p className="mt-2 whitespace-pre-wrap">{row.notes}</p>
        </div>
      ),
      form: (
        <ReviewForm action={reviewApproval} id={row.id} />
      ),
    })),
    ...(outreach.data ?? []).map((row) => {
      const company = nestedString(row.prospects, "company");
      return {
        key: `outreach-${row.id}`,
        kind: `Outreach ${row.status}`,
        title: row.subject || "Untitled draft",
        createdAt: row.created_at,
        body: (
          <div className="text-sm">
            <p className="text-muted-foreground">
              <Link href={`/companies/${row.prospect_id}`} className="hover:underline">
                {company || "Company"}
              </Link>
            </p>
            <p className="mt-2 whitespace-pre-wrap">{row.body}</p>
          </div>
        ),
        form: (
          <form action={reviewOutreach} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="prospect_id" value={row.prospect_id} />
            <Textarea name="review_notes" placeholder="Review notes" aria-label="Review notes" />
            <DecisionButtons />
          </form>
        ),
      };
    }),
    ...[...(content.data ?? [])].sort(byContentRecency).map((row) => ({
      key: `content-${row.id}`,
      kind: "Content in review",
      title: row.title || "Untitled",
      createdAt: row.updated_at || row.created_at,
      body: <ContentPreview id={row.id} row={row} />,
      form: <ReviewForm action={reviewContent} id={row.id} />,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Approve, reject, or request changes. This only updates status. Agents and n8n act on approved rows. Nothing is sent or posted here.
        </p>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">The queue is clear.</p> : null}
      {items.map((item) => (
        <Card key={item.key}>
          <CardHeader>
            <CardDescription>
              <Badge variant="outline">{item.kind}</Badge> {formatWhen(item.createdAt)}
            </CardDescription>
            <CardTitle>{item.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {item.body}
            {item.form}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReviewForm({
  action,
  id,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="review_notes" placeholder="Review notes" aria-label="Review notes" />
      <DecisionButtons />
    </form>
  );
}

function DecisionButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approved">
        Approve
      </Button>
      <Button type="submit" name="decision" value="changes_requested" variant="outline">
        Request changes
      </Button>
      <Button type="submit" name="decision" value="rejected" variant="destructive">
        Reject
      </Button>
    </div>
  );
}

function ContentPreview({
  id,
  row,
}: {
  id: string;
  row: {
    caption: string | null;
    video_url: string | null;
    script_json: unknown;
    source_urls: string[] | null;
    platforms: string[] | null;
  };
}) {
  const script = (row.script_json || {}) as {
    hook?: string;
    full_script?: string;
    caption_draft?: string;
    cta?: string;
  };
  const caption = row.caption || script.caption_draft;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        {(row.platforms || []).join(" · ") || "No platforms"}
        {" · "}
        <Link href={`/content/${id}`} className="text-primary hover:underline">
          Open the script
        </Link>
      </p>
      {row.video_url ? (
        <video src={row.video_url} controls className="max-h-80 w-full rounded-lg bg-black" />
      ) : (
        <p className="text-muted-foreground">No video file yet.</p>
      )}
      {script.hook ? <p>Hook: {script.hook}</p> : null}
      {caption ? (
        <div>
          <p className="text-xs text-muted-foreground">Caption</p>
          <p className="whitespace-pre-wrap">{caption}</p>
        </div>
      ) : null}
      {script.full_script ? (
        <div>
          <p className="text-xs text-muted-foreground">Script</p>
          <p className="whitespace-pre-wrap">{script.full_script}</p>
        </div>
      ) : null}
      {(row.source_urls || []).length > 0 ? (
        <ul className="list-disc pl-4">
          {(row.source_urls || []).map((source) => (
            <li key={source}>
              <a href={source} className="underline" target="_blank" rel="noreferrer">
                {source}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No sources attached.</p>
      )}
    </div>
  );
}
