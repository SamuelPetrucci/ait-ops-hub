import Link from "next/link";
import { BufferRefresh } from "@/components/buffer-refresh";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth";
import { bufferConfigured } from "@/lib/buffer";
import { recordIntegrationChecks } from "@/lib/integration-audit";
import { getIntegrations, getProfile, type IntegrationStatus } from "@/lib/integrations";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user } = await requireOwner();
  const [profile, integrations] = await Promise.all([getProfile(), getIntegrations()]);
  await recordIntegrationChecks(integrations);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Account</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator identity and the tools this hub talks to.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-card/60 p-5 ring-1 ring-foreground/10">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Operator</p>
          <h2 className="mt-2 text-2xl font-medium">{profile.name}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Fact label="Signed in as" value={user.email || profile.email} />
            <Fact label="Owner email" value={profile.email} />
            <Fact label="Organization" value={profile.organization} />
            <Fact
              label="Password gate"
              value={profile.passwordGate ? "Enabled" : "Missing OPS_PASSWORD"}
            />
          </dl>
        </div>
        <div className="rounded-3xl bg-card/60 p-5 ring-1 ring-foreground/10">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Quick links</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/integrations" className="rounded-xl bg-background/40 px-3 py-2 hover:bg-background/60">
              Integrations status
            </Link>
            <Link href="/content" className="rounded-xl bg-background/40 px-3 py-2 hover:bg-background/60">
              Content + Buffer calendar
            </Link>
            <Link href="/leads" className="rounded-xl bg-background/40 px-3 py-2 hover:bg-background/60">
              Leads
            </Link>
          </div>
          <div className="mt-4">
            <BufferRefresh configured={bufferConfigured()} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Integrations</h2>
            <p className="text-sm text-muted-foreground">Live connection checks from this server.</p>
          </div>
          <Link href="/integrations" className="text-xs text-muted-foreground hover:text-foreground">
            Full page
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map((item) => (
            <IntegrationTile key={item.id} {...item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all">{value}</dd>
    </div>
  );
}

function IntegrationTile({
  name,
  description,
  status,
  detail,
  href,
  docs,
}: {
  name: string;
  description: string;
  status: IntegrationStatus;
  detail: string;
  href?: string;
  docs?: string;
}) {
  return (
    <article className="rounded-3xl bg-card/60 p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-3 text-sm leading-relaxed">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Open
          </a>
        ) : null}
        {docs ? (
          <a href={docs} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
            Docs
          </a>
        ) : null}
      </div>
    </article>
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
