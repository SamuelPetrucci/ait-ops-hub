import Link from "next/link";
import { BufferRefresh } from "@/components/buffer-refresh";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth";
import { bufferConfigured } from "@/lib/buffer";
import { readIntegrationHistory, recordIntegrationChecks } from "@/lib/integration-audit";
import { getIntegrations, type IntegrationStatus } from "@/lib/integrations";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireOwner();
  const integrations = await getIntegrations();
  await recordIntegrationChecks(integrations);
  const history = await readIntegrationHistory();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Connections</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tools wired into Ops Hub and whether this server can reach them right now.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profile" className="text-xs text-muted-foreground hover:text-foreground">
            Profile
          </Link>
          <BufferRefresh configured={bufferConfigured()} />
        </div>
      </div>

      <section className="grid gap-3">
        {integrations.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-3xl bg-card/60 p-5 ring-1 ring-foreground/10"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{item.name}</h2>
              <StatusBadge status={item.status} />
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <p className="text-sm leading-relaxed">{item.detail}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Open resource
                </a>
              ) : null}
              {item.docs ? (
                <a
                  href={item.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Docs
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Recent checks</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit rows yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-card/40 px-3 py-2 text-sm ring-1 ring-foreground/8"
              >
                <span>
                  <span className="font-medium capitalize">{row.integration_id}</span>
                  <span className="ml-2 text-muted-foreground">{row.detail}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.status} ·{" "}
                  {new Date(row.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const label =
    status === "connected"
      ? "Connected"
      : status === "configured"
        ? "Configured"
        : status === "degraded"
          ? "Degraded"
          : "Missing";
  const className =
    status === "connected"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
      : status === "configured"
        ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
        : status === "degraded"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
          : "border-rose-400/40 bg-rose-400/10 text-rose-100";
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
