export default function ReferencesLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex w-full flex-col gap-6 md:gap-8">
      <span className="sr-only">Loading references</span>
      <div className="h-32 animate-pulse rounded-3xl bg-white/50 ring-1 ring-ink/10" />
      <div className="h-24 animate-pulse rounded-3xl bg-white/40 ring-1 ring-ink/10" />
      <div className="flex flex-col gap-3">
        <div className="h-48 animate-pulse rounded-3xl bg-white/55 ring-1 ring-ink/10" />
        <div className="h-48 animate-pulse rounded-3xl bg-white/55 ring-1 ring-ink/10" />
        <div className="h-48 animate-pulse rounded-3xl bg-white/55 ring-1 ring-ink/10" />
      </div>
    </div>
  );
}
