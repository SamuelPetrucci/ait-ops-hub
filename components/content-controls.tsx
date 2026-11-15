"use client";

import { useTransition, useState } from "react";
import { moveContent, reviewContent, scheduleToBuffer } from "@/app/actions/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTENT_COLUMNS } from "@/lib/constants";

const STATUS_OPTIONS = CONTENT_COLUMNS.map(([value, label]) => ({ value, label }));

export function ContentStatusSelect({
  id,
  currentStatus,
  size = "default",
}: {
  id: string;
  currentStatus: string;
  size?: "sm" | "default";
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);

  function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setStatus(newStatus);
    startTransition(async () => {
      try {
        if (newStatus === "approved" || newStatus === "skipped") {
          const formData = new FormData();
          formData.set("id", id);
          formData.set("decision", newStatus);
          await reviewContent(formData);
        } else {
          await moveContent(id, newStatus);
        }
      } catch (error) {
        setStatus(currentStatus);
        console.error("Failed to update status:", error);
      }
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size={size} className="min-w-28 capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="capitalize">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const CHANNEL_OPTIONS = [
  { id: "youtube_viral_digests", label: "YouTube Viral Digests", required: true },
  { id: "instagram", label: "Instagram", required: true },
  { id: "youtube_johnny_snow", label: "YouTube Johnny Snow", required: false },
];

export function ScheduleInBuffer({
  id,
  videoUrl,
  caption,
  hook,
  suggestedTime,
}: {
  id: string;
  videoUrl: string | null;
  caption: string;
  hook: string;
  suggestedTime: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(suggestedTime);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["youtube_viral_digests", "instagram"]);
  const [youtubeTitle, setYoutubeTitle] = useState(() => {
    const truncated = hook.slice(0, 67);
    return truncated.length < hook.length ? `${truncated}...` : truncated;
  });

  function toggleChannel(channelId: string) {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoUrl) {
      setError("No video URL available for this content");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("scheduled_at", scheduledAt);
        formData.set("video_url", videoUrl);
        formData.set("caption", caption);
        formData.set("youtube_title", youtubeTitle);
        for (const ch of selectedChannels) {
          formData.append("channels", ch);
        }
        await scheduleToBuffer(formData);
        setIsOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule");
      }
    });
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={!videoUrl}
        className="gap-1.5"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
        Schedule in Buffer
      </Button>
    );
  }

  return (
    <div className="rounded-xl bg-card/80 p-4 ring-1 ring-foreground/10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Schedule in Buffer</h3>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3">
          <div>
            <Label htmlFor={`schedule-time-${id}`} className="text-xs">
              Schedule time (America/New_York)
            </Label>
            <Input
              id={`schedule-time-${id}`}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Channels</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((channel) => (
                <label
                  key={channel.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition ${
                    selectedChannels.includes(channel.id)
                      ? "bg-primary/10 text-primary ring-primary/30"
                      : "bg-muted/30 text-muted-foreground ring-muted hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="sr-only"
                  />
                  <span>{channel.label}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedChannels.some((ch) => ch.startsWith("youtube_")) ? (
            <div>
              <Label htmlFor={`youtube-title-${id}`} className="text-xs">
                YouTube title ({youtubeTitle.length}/70 chars)
              </Label>
              <Input
                id={`youtube-title-${id}`}
                type="text"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value.slice(0, 70))}
                maxLength={70}
                className="mt-1"
              />
            </div>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={isPending || selectedChannels.length === 0}
          className="w-full"
        >
          {isPending ? "Scheduling..." : "Schedule Post"}
        </Button>
      </form>
    </div>
  );
}
