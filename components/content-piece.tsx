import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { LiveLink } from "@/lib/content";
import { labelize } from "@/lib/format";

export function ContentPiece({
  id,
  code,
  title,
  status,
  hook,
  platforms,
  agent,
  videoUrl,
  notionUrl,
  links,
}: {
  id: string;
  code?: string | null;
  title: string;
  status: string;
  hook?: string;
  platforms?: string[] | null;
  agent?: string | null;
  videoUrl?: string | null;
  notionUrl?: string | null;
  links?: LiveLink[];
}) {
  const context = [code, agent, (platforms || []).slice(0, 3).join(", ")].filter(Boolean).join(" · ");
  return (
    <article className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {context ? <p className="truncate text-xs text-muted-foreground">{context}</p> : null}
          <Link href={`/content/${id}`} className="mt-0.5 block font-medium hover:underline">
            {title}
          </Link>
        </div>
        <Badge variant="outline" className="capitalize">
          {labelize(status)}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {hook || "No script is stored on this row yet."}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <Link href={`/content/${id}`} className="text-primary hover:underline">
          Script
        </Link>
        {videoUrl ? (
          <a href={videoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Video
          </a>
        ) : null}
        {notionUrl ? (
          <a href={notionUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Notion
          </a>
        ) : null}
        {(links || []).map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {link.label}
          </a>
        ))}
      </div>
    </article>
  );
}
