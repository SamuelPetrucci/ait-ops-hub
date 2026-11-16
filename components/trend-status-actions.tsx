"use client";

import { useState, useTransition } from "react";
import { setTrendStatus } from "@/app/actions/trends";
import { Button } from "@/components/ui/button";

export function TrendStatusActions({ id, status }: { id: string; status: string }) {
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<"" | "skipped" | "used">("");
  const [pending, startTransition] = useTransition();

  function apply(next: "skipped" | "used") {
    setError("");
    setPendingAction(next);
    startTransition(async () => {
      const result = await setTrendStatus(id, next);
      setPendingAction("");
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || status === "skipped"}
          aria-pressed={status === "skipped"}
          onClick={() => apply("skipped")}
        >
          {pendingAction === "skipped" ? "Saving" : status === "skipped" ? "Skipped" : "Skip"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || status === "used"}
          aria-pressed={status === "used"}
          onClick={() => apply("used")}
        >
          {pendingAction === "used" ? "Saving" : status === "used" ? "Used" : "Mark used"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
