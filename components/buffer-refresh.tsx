"use client";

import { useState, useTransition } from "react";
import { refreshBufferAnalytics } from "@/app/actions/buffer";
import { Button } from "@/components/ui/button";

export function BufferRefresh({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !configured}
        onClick={() => {
          startTransition(async () => {
            const result = await refreshBufferAnalytics();
            setMessage(result.ok ? `Synced ${result.result.upserted} posts` : result.error);
          });
        }}
      >
        {pending ? "Refreshing…" : "Refresh Buffer"}
      </Button>
      {message ? <p className="max-w-xs text-right text-[11px] text-muted-foreground">{message}</p> : null}
      {!configured ? (
        <p className="max-w-xs text-right text-[11px] text-muted-foreground">
          Add BUFFER_API_KEY to keep these numbers live.
        </p>
      ) : null}
    </div>
  );
}
