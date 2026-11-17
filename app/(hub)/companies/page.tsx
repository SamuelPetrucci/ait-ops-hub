import { redirect } from "next/navigation";

export default async function CompaniesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw) query.set(key, raw);
  }
  const suffix = query.toString();
  redirect(suffix ? `/crm?${suffix}` : "/crm");
}
