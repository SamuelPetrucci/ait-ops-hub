import { redirect } from "next/navigation";
import { crmSearchParams, parseCrmFilters } from "@/lib/crm";

export const metadata = { title: "Clients" };

export default async function ClientsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseCrmFilters(params);
  const qs = crmSearchParams({ scope: "clients", view: "list", filters });
  redirect(`/crm?${qs}`);
}
