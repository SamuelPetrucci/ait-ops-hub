"use client";

import { useTransition, useState } from "react";
import { moveContent, reviewContent, scheduleToBuffer } from "@/app/actions/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  { id: "youtube_viral_digests", label: "YouTube Viral Digests" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube_johnny_snow", label: "YouTube Johnny Snow" },
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
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "youtube_viral_digests",
    "instagram",
  ]);
  const [description, setDescription] = useState(() => (caption || hook || "").trim());
  const [youtubeTitle, setYoutubeTitle] = useState(() => {
    const source = (hook || caption || "").replace(/\s+/g, " ").trim();
    if (source.length <= 70) return source;
    return `${source.slice(0, 69).trimEnd()}…`;
  });

  function toggleChannel(channelId: string) {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((c) => c !== channelId) : [...prev, channelId],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoUrl) {
      setError("No public video URL available for this content");
      return;
    }
    if (!description.trim()) {
      setError("Add a description/caption before scheduling");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("scheduled_at", scheduledAt);
        formData.set("video_url", videoUrl);
        formData.set("caption", description.trim());
        formData.set("youtube_title", youtubeTitle.trim());
        for (const ch of selectedChannels) formData.append("channels", ch);
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
        title={videoUrl ? `Suggested: ${suggestedTime}` : "Needs a public video URL"}
      >
        Schedule · {suggestedTime.replace("T", " ")}
      </Button>
    );
  }

  return (
    <div className="rounded-xl bg-card/80 p-4 ring-1 ring-foreground/10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Schedule in Buffer</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Suggested slot from your Buffer posting schedule (America/New_York).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        {error ? (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}

        <div className="grid gap-3">
          <div>
            <Label htmlFor={`schedule-time-${id}`} className="text-xs">
              Post time (America/New_York)
            </Label>
            <Input
              id={`schedule-time-${id}`}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor={`caption-${id}`} className="text-xs">
              Description / caption (required)
            </Label>
            <Textarea
              id={`caption-${id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-28"
              placeholder="What viewers read under the video"
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{description.trim().length} characters</p>
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
                YouTube title ({youtubeTitle.length}/70)
              </Label>
              <Input
                id={`youtube-title-${id}`}
                type="text"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value.slice(0, 70))}
                maxLength={70}
                className="mt-1"
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Title goes on YouTube; the description above is the post body on every channel.
              </p>
            </div>
          ) : null}
        </div>

        <Button type="submit" disabled={isPending || selectedChannels.length === 0 || !description.trim()} className="w-full">
          {isPending ? "Scheduling…" : "Schedule with description"}
        </Button>
      </form>
    </div>
  );
}
