import { formatWhen, labelize } from "@/lib/format";
import {
  formatCount,
  formatDuration,
  nicheLabel,
  platformLabel,
  type ReferenceCardModel,
} from "@/lib/references";

export function ReferenceCard({ reference }: { reference: ReferenceCardModel }) {
  const niche = reference.account?.niche || null;
  const handle = reference.creatorHandle ? `@${reference.creatorHandle.replace(/^@/, "")}` : null;
  const views = formatCount(reference.views);
  const likes = formatCount(reference.likes);
  const comments = formatCount(reference.comments);
  const shares = formatCount(reference.shares);
  const duration = formatDuration(reference.durationS);
  const when = reference.postedAt || reference.sentAt || reference.createdAt;

  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-white/55 p-4 ring-1 ring-ink/10 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {niche ? <Badge>{nicheLabel(niche)}</Badge> : null}
            <Badge muted>{platformLabel(reference.platform)}</Badge>
            {reference.formatTag ? <Badge soft>{labelize(reference.formatTag)}</Badge> : null}
            {duration ? <Badge soft>{duration}</Badge> : null}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink">
            {truncate(reference.title, 140)}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            {[handle, reference.channelName].filter(Boolean).join(" · ") || "Unknown creator"}
            {" · "}
            <time dateTime={when}>{formatWhen(when)} ET</time>
          </p>
        </div>
        {reference.url ? (
          <a
            href={reference.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-signal hover:underline"
          >
            Open post
          </a>
        ) : null}
      </div>

      {reference.whyItWorks ? (
        <p className="rounded-2xl bg-signal/10 px-3 py-2 text-sm leading-relaxed text-ink">
          <span className="mr-2 text-[11px] tracking-[0.14em] text-signal uppercase">Why it works</span>
          {reference.whyItWorks}
        </p>
      ) : null}

      {reference.account?.whyTrack ? (
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="mr-2 text-[11px] tracking-[0.14em] uppercase">Why track</span>
          {reference.account.whyTrack}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {views ? <Stat label="Views" value={views} /> : null}
        {likes ? <Stat label="Likes" value={likes} /> : null}
        {comments ? <Stat label="Comments" value={comments} /> : null}
        {shares ? <Stat label="Shares" value={shares} /> : null}
        {reference.followers != null ? (
          <Stat label="Followers" value={formatCount(reference.followers) || "—"} />
        ) : null}
        {reference.account?.brand ? <Stat label="Brand" value={labelize(reference.account.brand)} /> : null}
      </div>

      {reference.account?.profileUrl ? (
        <a
          href={reference.account.profileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-signal hover:underline"
        >
          View creator profile
        </a>
      ) : null}
    </article>
  );
}

function Badge({
  children,
  muted,
  soft,
}: {
  children: string;
  muted?: boolean;
  soft?: boolean;
}) {
  const className = muted
    ? "bg-ink text-paper"
    : soft
      ? "bg-paper-2 text-ink-soft"
      : "bg-white text-ink ring-1 ring-ink/10";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] text-ink-soft">
      <span className="tracking-[0.12em] uppercase">{label}</span>
      <span className="font-display text-sm font-semibold text-ink tabular-nums">{value}</span>
    </span>
  );
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
