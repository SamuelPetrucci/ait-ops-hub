import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth";
import { liveLinks, scriptParts } from "@/lib/content";
import { formatWhen, labelize } from "@/lib/format";

export const metadata = { title: "Viewer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOwner();

  const lookup = UUID.test(id)
    ? await supabase.from("content_queue").select("*").eq("id", id).maybeSingle()
    : await supabase.from("content_queue").select("*").eq("content_id", id.toUpperCase()).maybeSingle();

  if (lookup.error) throw new Error(lookup.error.message);
  const data = lookup.data;
  if (!data) notFound();

  const script = scriptParts(data.script_json, data.caption);
  const posts = liveLinks(data.platform_links, data.review_notes);
  const platforms = (data.platforms || []) as string[];
  const sources = ((data.source_urls || []) as string[]).filter(Boolean);
  const readable = readableScript(script.fullScript);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <Link href="/content" className="hover:underline">
              Content
            </Link>
            {data.content_id ? ` · ${data.content_id}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-3xl">{data.title || "Untitled"}</h1>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="overflow-hidden rounded-3xl bg-black ring-1 ring-foreground/10">
          {data.video_url ? (
            <video
              key={data.video_url}
              src={data.video_url}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center px-6 text-sm text-white/60">
              No video file yet. Script is still available on the right.
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3 text-sm">
            {data.video_url ? (
              <a href={data.video_url} target="_blank" rel="noreferrer" className="text-amber-200 hover:underline">
                Open video file
              </a>
            ) : null}
            {data.notion_page_url ? (
              <a href={data.notion_page_url} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">
                Notion
              </a>
            ) : null}
            {posts.map((post) => (
              <a
                key={post.href}
                href={post.href}
                target="_blank"
                rel="noreferrer"
                className="text-white/70 hover:text-white"
              >
                {post.label}
              </a>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {script.hook ? (
            <ScriptBlock label="Hook" text={cleanLine(script.hook)} emphasize />
          ) : null}
          {readable || script.fullScript ? (
            <ScriptBlock label="Script" text={readable || script.fullScript} />
          ) : null}
          {script.cta ? <ScriptBlock label="Call to action" text={script.cta} /> : null}
          {script.caption ? <ScriptBlock label="Caption" text={script.caption} /> : null}
          {!script.hook && !script.fullScript && !script.cta && !script.caption ? (
            <p className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
              This row has no script yet.
              {data.notion_page_url ? " Check Notion for the longer draft." : ""}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
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
          <p className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
            {data.review_notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ScriptBlock({ label, text, emphasize = false }: { label: string; text: string; emphasize?: boolean }) {
  if (!text) return null;
  return (
    <section className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <h2 className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{label}</h2>
      <p
        className={`mt-2 whitespace-pre-wrap leading-relaxed ${emphasize ? "text-base font-medium" : "text-sm text-foreground/90"}`}
      >
        {text}
      </p>
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

/** Strip VO / TTS production directions so the script is readable on the site. */
function readableScript(raw: string) {
  if (!raw) return "";
  const lines = raw
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter((line) => {
      if (!line) return false;
      if (/^vo\b/i.test(line) && line.length < 160 && /tts|exaggeration|cfg_weight|elevenlabs|kokoro/i.test(line)) {
        return false;
      }
      if (/^\[1[.,]\d+s/i.test(line)) return false;
      return true;
    });
  return lines.join("\n\n").trim();
}

function cleanLine(line: string) {
  return line
    .replace(/^\(0-1s\)\s*/i, "")
    .replace(/^VO\s*\([^)]*\):\s*/i, "")
    .replace(/^VO:\s*/i, "")
    .replace(/^\[HERO[^\]]*\]\s*/i, "")
    .trim();
}
