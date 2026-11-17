import { redirect } from "next/navigation";
import { crmSearchParams, parseCrmFilters } from "@/lib/crm";

export const metadata = { title: "Leads" };

export default async function LeadsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseCrmFilters(params);
  const qs = crmSearchParams({ scope: "leads", view: "list", filters });
  redirect(qs ? `/crm?${qs}` : "/crm");
}
