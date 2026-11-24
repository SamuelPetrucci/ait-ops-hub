import Link from "next/link";
import { ReferenceCard } from "@/components/reference-card";
import { ReferenceFilters } from "@/components/reference-filters";
import { requireOwner } from "@/lib/auth";
import {
  filtersActive,
  nicheChoices,
  platformChoices,
  readReferenceFilters,
  referenceMatches,
  toReferenceCard,
  type ReferencePostInput,
} from "@/lib/references";

export const metadata = { title: "References" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string; platform?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filters = readReferenceFilters({
    niche: first(params.niche),
    platform: first(params.platform),
    q: first(params.q),
  });
  const { supabase } = await requireOwner();
  const result = await supabase
    .from("reference_posts")
    .select(
      "id, created_at, sent_at, posted_at, platform, url, resolved_url, creator_handle, channel_name, title_or_caption, duration_s, views, likes, comments, shares, followers, format_tag, why_it_works, notes, reference_accounts(id, handle, display_name, profile_url, brand, niche, followers, why_track)",
    )
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (result.error) throw new Error(result.error.message);

  const cards = ((result.data ?? []) as ReferencePostInput[]).map((row) => toReferenceCard(row));
  // Niche-type references: posts linked to a tracked account niche (or filter match).
  const nicheTyped = cards.filter((card) => Boolean(card.account?.niche));
  const visible = nicheTyped.filter((card) => referenceMatches(card, filters));
  const niches = nicheChoices(nicheTyped.map((card) => card.account?.niche || ""));
  const platforms = platformChoices(nicheTyped.map((card) => card.platform));
  const orphanCount = cards.length - nicheTyped.length;

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <div className="panel relative overflow-hidden rounded-3xl px-5 py-5 ring-1 ring-ink/10">
        <div className="mesh" aria-hidden>
          <span />
          <span />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-ink-soft uppercase">
              <Link href="/content" className="hover:text-ink">
                Content
              </Link>
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
              References
            </h1>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              {visible.length} {visible.length === 1 ? "niche reference" : "niche references"}
              {orphanCount > 0 ? ` · ${orphanCount} without a niche hidden` : ""}. Newest posts first.
            </p>
          </div>
          <Link href="/content" className="text-xs text-signal hover:underline">
            Content desk
          </Link>
        </div>
      </div>

      <ReferenceFilters
        key={`${filters.niche}|${filters.platform}|${filters.query}`}
        filters={filters}
        niches={niches}
        platforms={platforms}
      />

      {visible.length === 0 ? (
        <div className="rounded-3xl bg-white/55 px-4 py-12 text-center ring-1 ring-ink/10">
          <p className="font-display text-lg font-semibold text-ink">
            {nicheTyped.length === 0 ? "No niche references yet" : "No references in this view"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            {nicheTyped.length === 0
              ? "Archive posts into reference_posts with a linked reference_accounts niche to see them here."
              : "Try another niche, platform, or search."}
          </p>
          {filtersActive(filters) ? (
            <Link
              href="/content/references"
              className="mt-4 inline-block text-sm font-medium text-signal hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((reference) => (
            <ReferenceCard key={reference.id} reference={reference} />
          ))}
        </div>
      )}
    </div>
  );
}
