import { ProspectDirectory } from "@/components/prospect-directory";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ProspectDirectory
      scope="leads"
      searchParams={params}
      title="Leads"
      description="Open pipeline companies. Filters only use values that exist in this list."
    />
  );
}
