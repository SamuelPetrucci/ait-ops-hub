import { redirect } from "next/navigation";
import { crmSearchParams, parseCrmFilters, parseScope } from "@/lib/crm";

export const metadata = { title: "Sales Map" };

export default async function ProspectMapRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseCrmFilters(params);
  const scope = parseScope(params.scope);
  const qs = crmSearchParams({ scope, view: "map", filters });
  redirect(`/crm?${qs}`);
}
