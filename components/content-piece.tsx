import Link from "next/link";
import { ContentStatusSelect, ScheduleInBuffer } from "@/components/content-controls";
import type { LiveLink } from "@/lib/content";
import { formatWhen } from "@/lib/format";

export function ContentPiece({
  id,
  code,
  title,
  status,
  hook,
  caption,
  platforms,
  agent,
  videoUrl,
  notionUrl,
  links,
  scheduledAt,
  suggestedTime,
  compact = false,
}: {
  id: string;
  code?: string | null;
  title: string;
  status: string;
  hook?: string;
  caption?: string;
  platforms?: string[] | null;
  agent?: string | null;
  videoUrl?: string | null;
  notionUrl?: string | null;
  links?: LiveLink[];
  scheduledAt?: string | null;
  suggestedTime?: string;
  compact?: boolean;
}) {
  const context = [code, agent, (platforms || []).slice(0, 3).join(", ")].filter(Boolean).join(" · ");

  if (compact) {
    return (
      <div className="group flex gap-3 rounded-2xl bg-card/80 p-2.5 ring-1 ring-foreground/10 transition hover:bg-card hover:ring-foreground/20">
        <Link href={`/content/${id}`} className="shrink-0">
          <VideoThumb src={videoUrl} className="h-16 w-28" />
        </Link>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/content/${id}`} className="line-clamp-1 text-sm font-medium hover:underline">
              {title}
            </Link>
            <ContentStatusSelect id={id} currentStatus={status} size="sm" />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {hook || "Open to read the script."}
          </p>
          {scheduledAt ? (
            <p className="mt-1 text-[10px] text-sky-300/90">
              {formatWhen(scheduledAt)}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <Link href={`/content/${id}`} className="relative block bg-black/40">
          <VideoThumb src={videoUrl} className="aspect-video h-full min-h-36 w-full sm:min-h-full" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-medium text-white">
            View on site
          </span>
        </Link>
        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {context ? <p className="truncate text-xs text-muted-foreground">{context}</p> : null}
              <Link href={`/content/${id}`} className="mt-0.5 block text-base font-medium hover:underline">
                {title}
              </Link>
              {scheduledAt ? (
                <p className="mt-0.5 text-xs text-sky-300/90">
                  Scheduled: {formatWhen(scheduledAt)}
                </p>
              ) : null}
            </div>
            <ContentStatusSelect id={id} currentStatus={status} />
          </div>
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {hook || "No script is stored on this row yet."}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <Link href={`/content/${id}`} className="font-medium text-primary hover:underline">
              Open viewer
            </Link>
            {videoUrl ? (
              <a href={videoUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                Raw file
              </a>
            ) : null}
            {notionUrl ? (
              <a href={notionUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                Notion
              </a>
            ) : null}
            {(links || []).map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          {status === "approved" && suggestedTime ? (
            <ScheduleInBuffer
              id={id}
              videoUrl={videoUrl || null}
              caption={caption || ""}
              hook={hook || ""}
              suggestedTime={suggestedTime}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function VideoThumb({ src, className }: { src?: string | null; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 text-[11px] text-muted-foreground ${className || ""}`}>
        No video
      </div>
    );
  }
  return (
    <video
      src={`${src}#t=0.1`}
      muted
      playsInline
      preload="metadata"
      className={`object-cover ${className || ""}`}
    />
  );
}
