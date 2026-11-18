"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateProspectStage } from "@/app/actions/mutations";
import { PROSPECT_STAGE_OPTIONS } from "@/lib/constants";

export function ProspectStageSelect({
  id,
  stage,
  className,
  compact = false,
}: {
  id: string;
  stage: string;
  className?: string;
  compact?: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [optimisticStage, setOptimisticStage] = useOptimistic(stage);

  function onChange(next: string) {
    if (next === optimisticStage) return;
    setError("");
    startTransition(async () => {
      setOptimisticStage(next);
      const result = await updateProspectStage(id, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className={className}>
      <select
        value={optimisticStage}
        disabled={pending}
        aria-label="CRM stage"
        aria-busy={pending}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded-lg border border-input bg-transparent text-sm disabled:opacity-60 ${
          compact ? "h-8 min-w-[8.5rem] max-w-[12rem] px-1.5" : "h-8 w-full min-w-[10rem] px-2"
        }`}
      >
        {PROSPECT_STAGE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
