import Link from "next/link";
import { reviewContent } from "@/app/actions/mutations";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth";
import { resolveVideoUrl, scriptParts } from "@/lib/content";

export const metadata = { title: "Approvals" };

type QueueRow = {
  id: string;
  content_id: string | null;
  title: string | null;
  script_json: unknown;
  caption: string | null;
  video_url: string | null;
  storage_path: string | null;
  created_at: string | null;
};

export default async function ApprovalsPage() {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("content_queue")
    .select("id, content_id, title, script_json, caption, video_url, storage_path, created_at")
    .eq("status", "in_review")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as QueueRow[];
  const resolved = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      resolvedVideoUrl: await resolveVideoUrl({
        video_url: row.video_url,
        storage_path: row.storage_path,
      }),
    }))
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Review</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review clips before they go live. Approve to move to scheduled, or reject to skip.
        </p>
      </header>

      {resolved.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-card/50 px-6 py-16 text-center ring-1 ring-foreground/10">
          <p className="text-lg font-medium">All caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No clips waiting for review. Check back later or{" "}
            <Link href="/content" className="text-primary hover:underline">
              browse all content
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {resolved.map((row) => {
            const script = scriptParts(row.script_json, row.caption);
            return (
              <ApprovalCard
                key={row.id}
                id={row.id}
                code={row.content_id}
                title={row.title}
                hook={script.hook}
                caption={script.caption}
                videoUrl={row.resolvedVideoUrl}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  id,
  code,
  title,
  hook,
  caption,
  videoUrl,
}: {
  id: string;
  code: string | null;
  title: string | null;
  hook: string;
  caption: string;
  videoUrl: string | null;
}) {
  return (
    <article className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <div className="bg-black">
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-6 text-sm text-white/60">
            No video yet
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          {code ? (
            <p className="text-xs text-muted-foreground">{code}</p>
          ) : null}
          <h2 className="mt-0.5 text-lg font-medium leading-snug">
            <Link href={`/content/${id}`} className="hover:underline">
              {title || "Untitled"}
            </Link>
          </h2>
        </div>

        {hook ? (
          <div>
            <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Hook</p>
            <p className="mt-1 text-sm leading-relaxed">{hook}</p>
          </div>
        ) : null}

        {caption ? (
          <div>
            <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Caption</p>
            <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {caption}
            </p>
          </div>
        ) : null}

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <form action={reviewContent} className="flex-1">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="approved" />
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full text-base sm:h-10 sm:text-sm"
            >
              Approve
            </Button>
          </form>
          <form action={reviewContent} className="flex-1">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="skipped" />
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="h-12 w-full text-base sm:h-10 sm:text-sm"
            >
              Reject
            </Button>
          </form>
        </div>
      </div>
    </article>
  );
}
