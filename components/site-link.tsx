import { siteLabel, siteUrl } from "@/lib/format";

export function SiteLink({
  website,
  className = "text-xs text-primary hover:underline",
  label,
}: {
  website?: string | null;
  className?: string;
  label?: string;
}) {
  const href = siteUrl(website);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {label || siteLabel(website)}
    </a>
  );
}
