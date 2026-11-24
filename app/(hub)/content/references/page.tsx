import Link from "next/link";
import { ContentChrome } from "@/components/content-chrome";
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

export const metadata = { title: "Content References" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ContentReferencesPage({
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
  // Live content references table is public.reference_posts (joined to reference_accounts.niche).
  // There is no public.references relation in this project.
  const result = await supabase
    .from("reference_posts")
    .select(
      "id, created_at, sent_at, posted_at, platform, url, resolved_url, creator_handle, channel_name, title_or_caption, duration_s, views, likes, comments, shares, followers, format_tag, why_it_works, notes, reference_accounts(id, handle, display_name, profile_url, brand, niche, followers, why_track)",
    )
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (result.error) throw new Error(result.error.message);

  const cards = ((result.data ?? []) as ReferencePostInput[]).map((row) => toReferenceCard(row));
  const nicheTyped = cards.filter((card) => Boolean(card.account?.niche));
  const visible = nicheTyped.filter((card) => referenceMatches(card, filters));
  const niches = nicheChoices(nicheTyped.map((card) => card.account?.niche || ""));
  const platforms = platformChoices(nicheTyped.map((card) => card.platform));
  const orphanCount = cards.length - nicheTyped.length;

  return (
    <ContentChrome
      active="references"
      title="Content References"
      description={
        <>
          {visible.length} {visible.length === 1 ? "reference" : "references"} from the references archive
          {orphanCount > 0 ? ` · ${orphanCount} without a niche hidden` : ""}. Newest posts first.
        </>
      }
    >
      <ReferenceFilters
        key={`${filters.niche}|${filters.platform}|${filters.query}`}
        filters={filters}
        niches={niches}
        platforms={platforms}
      />

      {visible.length === 0 ? (
        <div className="rounded-3xl bg-white/55 px-4 py-12 text-center ring-1 ring-ink/10">
          <p className="font-display text-lg font-semibold text-ink">
            {nicheTyped.length === 0 ? "No content references yet" : "No references in this view"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            {nicheTyped.length === 0
              ? "Archive posts into the references tables with a niche on the linked account to see them here."
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
    </ContentChrome>
  );
}
