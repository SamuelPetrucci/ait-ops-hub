import { ProspectDirectory } from "@/components/prospect-directory";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ProspectDirectory
      scope="clients"
      searchParams={params}
      title="Clients"
      description="Won, paid, and delivered companies. Open a row to manage contacts, deals, and notes."
    />
  );
}
