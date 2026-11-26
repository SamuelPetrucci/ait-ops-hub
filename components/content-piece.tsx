import type { ReactNode } from "react";
import Link from "next/link";
import { ContentStatusSelect, ScheduleInBuffer } from "@/components/content-controls";
import { Badge } from "@/components/ui/badge";
import type { ContentViewRollup, LiveLink } from "@/lib/content";
import { channelLabel, formatCount, formatNyDate, formatNyTime } from "@/lib/format";

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
  postedAt,
  suggestedTime,
  niche,
  views,
  ideas,
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
  postedAt?: string | null;
  suggestedTime?: string;
  niche?: string | null;
  views?: ContentViewRollup | null;
  ideas?: LiveLink[];
  compact?: boolean;
}) {
  const channels = (platforms || []).map((platform) => channelLabel(platform));
  const context = [code, agent].filter(Boolean).join(" · ");
  const goesUpAt = postedAt || scheduledAt;
  const goesUpLabel = postedAt ? "Posted" : scheduledAt ? "Scheduled" : "Not scheduled";

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
          <p className="mt-1 text-[10px] text-sky-300/90">
            {[
              channels.slice(0, 3).join(", "),
              goesUpAt ? `${goesUpLabel} ${formatNyDate(goesUpAt)} ${formatNyTime(goesUpAt)}` : null,
              views?.total != null ? `${formatCount(views.total)} views` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No channel or time yet"}
          </p>
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
              <div className="flex items-center gap-2">
                {context ? <p className="truncate text-xs text-muted-foreground">{context}</p> : null}
                {niche ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {niche}
                  </Badge>
                ) : null}
              </div>
              <Link href={`/content/${id}`} className="mt-0.5 block text-base font-medium hover:underline">
                {title}
              </Link>
            </div>
            <ContentStatusSelect id={id} currentStatus={status} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Channels">
              {channels.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {channels.map((channel, index) => {
                    const live = (links || []).find((link) =>
                      link.label.toLowerCase().includes(channel.toLowerCase()),
                    );
                    const count = views?.channels.find(
                      (item) => channelLabel(item.channel).toLowerCase() === channel.toLowerCase(),
                    );
                    const pill = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                        {channel}
                        {count ? (
                          <span className="tabular-nums text-muted-foreground">{formatCount(count.views)}</span>
                        ) : null}
                      </span>
                    );
                    return live ? (
                      <a key={`${channel}-${index}`} href={live.href} target="_blank" rel="noreferrer" className="hover:opacity-80">
                        {pill}
                      </a>
                    ) : (
                      <span key={`${channel}-${index}`}>{pill}</span>
                    );
                  })}
                </span>
              ) : (
                <Empty>No channel yet</Empty>
              )}
            </Fact>
            <Fact label="Goes up">
              {goesUpAt ? (
                <span>
                  <span className="block text-sm font-medium text-foreground">{formatNyDate(goesUpAt)}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {formatNyTime(goesUpAt)}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    {goesUpLabel}
                  </span>
                </span>
              ) : (
                <Empty>Not scheduled</Empty>
              )}
            </Fact>
            <Fact label="Views">
              {views ? (
                <span>
                  <span className="block text-sm font-medium tabular-nums text-foreground">
                    {formatCount(views.total)}
                  </span>
                  {views.up != null ? (
                    <span className="mt-0.5 block text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                      ↑ {formatCount(views.up)} since last check
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                      Latest check
                    </span>
                  )}
                </span>
              ) : (
                <Empty>No views yet</Empty>
              )}
            </Fact>
            <Fact label="Idea from">
              {(ideas || []).length ? (
                <span className="flex flex-col gap-1">
                  {(ideas || []).slice(0, 2).map((idea) => (
                    <a
                      key={idea.href}
                      href={idea.href}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {idea.label}
                    </a>
                  ))}
                  {(ideas || []).length > 2 ? (
                    <span className="text-[11px] text-muted-foreground">+{(ideas || []).length - 2} more</span>
                  ) : null}
                </span>
              ) : (
                <Empty>No source linked</Empty>
              )}
            </Fact>
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>;
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
