export function Flash({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  if (!error && !notice) return null;
  return (
    <p
      className={
        error
          ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
      }
    >
      {error || notice}
    </p>
  );
}
