"use client";

import { useTransition, useState } from "react";
import { getNextFreeSlot, moveContent, reviewContent, scheduleToBuffer } from "@/app/actions/mutations";
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
import { isNyLocalInFuture, nyLocalInputToDueAt } from "@/lib/ny-time";
import {
  CONTENT_STATUS_GROUPS,
  CONTENT_GROUP_ORDER,
  getContentGroupFromStatus,
  getCanonicalStatus,
  type ContentStatusGroup,
} from "@/lib/status-groups";

const INSTAGRAM_CAPTION_MAX = 2200;

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
  const currentGroup = getContentGroupFromStatus(currentStatus);
  const [selectedGroup, setSelectedGroup] = useState<ContentStatusGroup>(currentGroup);

  function handleChange(newGroup: ContentStatusGroup) {
    if (newGroup === selectedGroup) return;
    const newStatus = getCanonicalStatus(newGroup, currentStatus);
    setSelectedGroup(newGroup);
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
        setSelectedGroup(currentGroup);
        console.error("Failed to update status:", error);
      }
    });
  }

  return (
    <Select value={selectedGroup} onValueChange={(v) => handleChange(v as ContentStatusGroup)} disabled={isPending}>
      <SelectTrigger size={size} className="min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTENT_GROUP_ORDER.map((group) => (
          <SelectItem key={group} value={group}>
            {CONTENT_STATUS_GROUPS[group].label}
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
  const [slotLabel, setSlotLabel] = useState(suggestedTime);
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

  function openForm() {
    setError(null);
    setIsOpen(true);
    startTransition(async () => {
      try {
        const next = await getNextFreeSlot();
        setSlotLabel(next);
        setScheduledAt(next);
      } catch {
        if (!isNyLocalInFuture(scheduledAt)) {
          setError("Suggested slot is in the past. Pick a later Eastern Time.");
        }
      }
    });
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
    if (selectedChannels.includes("instagram") && description.trim().length > INSTAGRAM_CAPTION_MAX) {
      setError(
        `Instagram captions cannot exceed ${INSTAGRAM_CAPTION_MAX} characters. Shorten the description or deselect Instagram.`,
      );
      return;
    }
    try {
      nyLocalInputToDueAt(scheduledAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule time must be in the future");
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
        const result = await scheduleToBuffer(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
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
        onClick={openForm}
        disabled={!videoUrl}
        className="gap-1.5"
        title={videoUrl ? `Suggested: ${slotLabel}` : "Needs a public video URL"}
      >
        Schedule · {slotLabel.replace("T", " ")}
      </Button>
    );
  }

  const captionTooLongForIg =
    selectedChannels.includes("instagram") && description.trim().length > INSTAGRAM_CAPTION_MAX;

  return (
    <div className="rounded-xl bg-card/80 p-4 ring-1 ring-foreground/10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Schedule in Buffer</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Suggested slot from your Buffer posting schedule (Eastern Time).
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
              Post time (Eastern Time)
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
            <p
              className={`mt-1 text-[11px] ${captionTooLongForIg ? "text-destructive" : "text-muted-foreground"}`}
            >
              {description.trim().length} characters
              {selectedChannels.includes("instagram")
                ? ` · Instagram max ${INSTAGRAM_CAPTION_MAX}`
                : ""}
            </p>
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

        <Button
          type="submit"
          disabled={isPending || selectedChannels.length === 0 || !description.trim() || captionTooLongForIg}
          className="w-full"
        >
          {isPending ? "Scheduling…" : "Schedule with description"}
        </Button>
      </form>
    </div>
  );
}
