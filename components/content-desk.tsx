"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { adjustContent, holdContent, reviewContent } from "@/app/actions/mutations";
import { ScheduleInBuffer } from "@/components/content-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContentViewRollup, LiveLink } from "@/lib/content";
import { channelKey, channelLabel, formatCount, formatNyDate, formatNyTime } from "@/lib/format";

export type DeskItem = {
  id: string;
  code: string | null;
  title: string;
  status: string;
  hook: string;
  caption: string;
  platforms: string[];
  agent: string | null;
  videoUrl: string | null;
  scheduledAt: string | null;
  postedAt: string | null;
  niche: string | null;
  ideas: LiveLink[];
  views: ContentViewRollup | null;
  suggestedTime: string;
  lane: "agent" | "before" | "cleared" | "out" | "live";
};

const LANE_COPY = {
  agent: {
    title: "With the agent",
    detail: "Still being drafted. An adjustment here is the copy that comes back for approval.",
  },
  before: {
    title: "Waiting on you",
    detail: "Ready for a decision. Approve a row when it can go out, or adjust the copy first.",
  },
  cleared: {
    title: "Cleared for Grok",
    detail: "Approved. Grok may post these as they stand. Save an edit to change what it posts, or hold to take it back.",
  },
  out: {
    title: "Going out",
    detail: "Scheduled. Hold cancels the Buffer slot and returns the row to review.",
  },
} as const;

export function DayPosts({
  dayLabel,
  channels,
  activeChannel,
  items,
}: {
  dayLabel: string;
  channels: { key: string; label: string; count: number; href: string }[];
  activeChannel: string;
  items: DeskItem[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-sm font-semibold text-ink">{dayLabel}</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          {activeChannel
            ? "This channel on the selected day."
            : "Pick a channel to narrow this day."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {channels.map((channel) => {
          const active = channel.key === activeChannel || (channel.key === "all" && !activeChannel);
          return (
            <Link
              key={channel.key}
              href={channel.href}
              className={`rounded-full px-3 py-1.5 text-xs ring-1 ${
                active ? "bg-ink text-paper ring-ink" : "bg-white/50 text-ink-soft ring-ink/10 hover:text-ink"
              }`}
            >
              {channel.label} <span className="tabular-nums">{channel.count}</span>
            </Link>
          );
        })}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white/40 px-4 py-3 text-sm text-ink-soft ring-1 ring-ink/10">
          Nothing on this day{activeChannel ? " for that channel" : ""}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <DeskRow key={item.id} item={item} focusChannel={activeChannel} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ContentDesk({
  lanes,
}: {
  lanes: {
    kind: keyof typeof LANE_COPY;
    items: DeskItem[];
    total: number;
    moreHref?: string;
  }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {lanes.map((lane) => (
        <Lane key={lane.kind} {...lane} />
      ))}
    </div>
  );
}

function Lane({
  kind,
  items,
  total,
  moreHref,
}: {
  kind: keyof typeof LANE_COPY;
  items: DeskItem[];
  total: number;
  moreHref?: string;
}) {
  const copy = LANE_COPY[kind];
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">
            {copy.title} <span className="tabular-nums text-ink-soft">{total}</span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">{copy.detail}</p>
        </div>
        {moreHref && total > items.length ? (
          <Link href={moreHref} className="shrink-0 text-xs text-signal hover:underline">
            View all {total}
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white/40 px-4 py-3 text-sm text-ink-soft ring-1 ring-ink/10">
          Nothing in this lane.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <DeskRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function DeskRow({ item, focusChannel = "" }: { item: DeskItem; focusChannel?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(item.title);
  const [hook, setHook] = useState(item.hook);
  const [caption, setCaption] = useState(item.caption);
  const when = item.postedAt || item.scheduledAt;
  const channels = item.platforms.map((platform) => channelLabel(platform));
  const gate =
    item.lane === "cleared"
      ? "Grok can post"
      : item.lane === "out"
        ? "Going out"
        : item.lane === "live"
          ? "Posted"
          : item.lane === "agent"
            ? "With the agent"
            : "Waiting on you";

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update this post");
      }
    });
  }

  function save(hold: boolean) {
    const formData = new FormData();
    formData.set("id", item.id);
    formData.set("title", title);
    formData.set("hook", hook);
    formData.set("caption", caption);
    if (hold) formData.set("hold", "1");
    run(() => adjustContent(formData));
  }

  return (
    <article className="rounded-2xl bg-card ring-1 ring-foreground/10">
      <div className="flex gap-3 p-3">
        <Link href={`/content/${item.id}`} className="shrink-0">
          <Thumb src={item.videoUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">
                {[item.code, item.agent, item.niche].filter(Boolean).join(" · ")}
              </p>
              <Link href={`/content/${item.id}`} className="block truncate text-sm font-medium hover:underline">
                {item.title}
              </Link>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium tracking-wide text-foreground uppercase">
              {gate}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{channels.length ? channels.join(" · ") : "No channel"}</span>
            <span className="tabular-nums">
              {when ? `${formatNyDate(when)} · ${formatNyTime(when)}` : "No time yet"}
            </span>
            <span className="tabular-nums">
              {focusedViews(item, focusChannel)}
            </span>
            {item.ideas[0] ? (
              <a href={item.ideas[0].href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Idea · {item.ideas[0].label}
              </a>
            ) : (
              <span>No idea link</span>
            )}
          </div>
          {item.hook ? <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">{item.hook}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.lane === "before" ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const formData = new FormData();
                    formData.set("id", item.id);
                    formData.set("decision", "approved");
                    await reviewContent(formData);
                  })
                }
              >
                Approve for Grok
              </Button>
            ) : null}
            {item.lane === "cleared" || item.lane === "out" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => holdContent(item.id))}>
                Hold
              </Button>
            ) : null}
            {item.lane === "live" ? null : (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen((value) => !value)}>
                {open ? "Close editor" : "Adjust copy"}
              </Button>
            )}
            {item.lane === "cleared" && item.suggestedTime ? (
              <ScheduleInBuffer
                id={item.id}
                videoUrl={item.videoUrl}
                caption={item.caption}
                hook={item.hook}
                suggestedTime={item.suggestedTime}
              />
            ) : null}
          </div>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
      {open ? (
        <form
          className="flex flex-col gap-3 border-t border-foreground/10 px-3 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            save(false);
          }}
        >
          <label className="block text-xs text-muted-foreground">
            Title
            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block text-xs text-muted-foreground">
            Hook
            <Textarea className="mt-1" value={hook} onChange={(event) => setHook(event.target.value)} />
          </label>
          <label className="block text-xs text-muted-foreground">
            Caption
            <Textarea className="mt-1" value={caption} onChange={(event) => setCaption(event.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">
            {item.lane === "cleared"
              ? "Saving keeps this approved, so Grok posts the edited copy."
              : item.lane === "out"
                ? "Saving updates the hub copy. Hold cancels the Buffer slot so this time does not go out."
                : item.lane === "agent"
                  ? "Saving updates the draft the agent is working from."
                  : "Saving keeps this in review until you approve it."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {item.lane === "cleared" ? "Save for Grok" : "Save adjustment"}
            </Button>
            {item.lane === "cleared" || item.lane === "out" ? (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => save(true)}>
                Save and hold
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </article>
  );
}

function focusedViews(item: DeskItem, focusChannel: string) {
  if (!item.views) return "No views yet";
  const match = focusChannel
    ? item.views.channels.find((channel) => channelKey(channel.channel) === focusChannel)
    : null;
  const total = match ? match.views : item.views.total;
  const up = match ? "" : item.views.up != null ? ` · up ${formatCount(item.views.up)}` : "";
  return `${formatCount(total)} views${up}`;
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="flex h-16 w-24 items-center justify-center rounded-xl bg-muted text-[10px] text-muted-foreground">
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
      className="h-16 w-24 rounded-xl object-cover"
    />
  );
}
