import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth";
import { liveLinks, scriptParts } from "@/lib/content";
import { formatWhen, labelize } from "@/lib/format";

export const metadata = { title: "Content" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireOwner();
  const { data, error } = await supabase.from("content_queue").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const script = scriptParts(data.script_json, data.caption);
  const posts = liveLinks(data.platform_links, data.review_notes);
  const platforms = (data.platforms || []) as string[];
  const sources = ((data.source_urls || []) as string[]).filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <Link href="/content" className="hover:underline">
              Content
            </Link>
            {data.content_id ? ` · ${data.content_id}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-medium">{data.title || "Untitled"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[data.assigned_agent, data.content_pillar, data.target_industry, platforms.join(", ")]
              .filter(Boolean)
              .join(" · ") || "Unassigned"}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {labelize(data.status)}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {data.video_url ? (
          <a href={data.video_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Video file
          </a>
        ) : null}
        {data.notion_page_url ? (
          <a href={data.notion_page_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Notion page
          </a>
        ) : null}
        {typeof data.tracking_link === "string" &&
        data.tracking_link.startsWith("http") &&
        data.tracking_link !== data.video_url ? (
          <a href={data.tracking_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Tracking link
          </a>
        ) : null}
        {posts.map((post) => (
          <a key={post.href} href={post.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {post.label}
          </a>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <ScriptBlock label="Hook" text={script.hook} />
          <ScriptBlock label="Script" text={script.fullScript} />
          <ScriptBlock label="Call to action" text={script.cta} />
          <ScriptBlock label="Caption" text={script.caption} />
          {!script.hook && !script.fullScript && !script.cta && !script.caption ? (
            <p className="text-sm text-muted-foreground">
              This row has no script yet.
              {data.notion_page_url ? " The Notion page is the place the longer draft is kept." : ""}
            </p>
          ) : null}
        </div>
        <aside className="flex flex-col gap-4">
          {data.video_url ? (
            <video src={data.video_url} controls className="w-full rounded-xl bg-black" />
          ) : (
            <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
              No video file yet.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
            <Fact label="Scheduled" value={formatWhen(data.scheduled_at)} />
            <Fact label="Posted" value={formatWhen(data.posted_at)} />
            <Fact label="Approved by" value={data.approved_by || "—"} />
            <Fact label="Reviewed" value={formatWhen(data.reviewed_at)} />
          </dl>
        </aside>
      </div>

      {sources.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Sources</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {sources.map((source) => (
              <li key={source}>
                <a href={source} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                  {source}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.review_notes ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Production notes</h2>
          <p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
            {data.review_notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ScriptBlock({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <section className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <h2 className="text-xs tracking-wide text-muted-foreground uppercase">{label}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
