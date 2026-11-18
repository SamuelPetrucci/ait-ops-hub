"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateProspectScore } from "@/app/actions/mutations";
import { OPPORTUNITY_SCORE_OPTIONS } from "@/lib/constants";

function toValue(score: number | null | undefined) {
  if (score == null || Number.isNaN(Number(score))) return "";
  return String(Math.round(Number(score)));
}

export function ProspectScoreSelect({
  id,
  score,
  className,
  compact = false,
}: {
  id: string;
  score: number | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [optimisticScore, setOptimisticScore] = useOptimistic(toValue(score));

  const options = (() => {
    const current = optimisticScore;
    if (!current || OPPORTUNITY_SCORE_OPTIONS.some(([value]) => value === current)) {
      return [...OPPORTUNITY_SCORE_OPTIONS];
    }
    return [...OPPORTUNITY_SCORE_OPTIONS, [current, `${current} · Custom`] as const];
  })();

  function onChange(next: string) {
    if (next === optimisticScore) return;
    setError("");
    startTransition(async () => {
      setOptimisticScore(next);
      const result = await updateProspectScore(id, next === "" ? null : Number(next));
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className={className}>
      <select
        value={optimisticScore}
        disabled={pending}
        aria-label="Opportunity score"
        aria-busy={pending}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className={`rounded-lg border border-input bg-transparent text-sm disabled:opacity-60 ${
          compact ? "h-7 max-w-[9.5rem] px-1.5" : "h-8 w-full min-w-[10rem] px-2"
        }`}
      >
        {options.map(([value, label]) => (
          <option key={value || "unscored"} value={value}>
            {compact && value ? value : label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
