import type { ReactNode } from "react";
import Link from "next/link";
import {
  crmHref,
  SCOPE_LABELS,
  type CrmFilters,
  type CrmView,
  type ProspectScope,
} from "@/lib/crm";

const SCOPES: ProspectScope[] = ["leads", "clients", "all"];
const VIEWS: { id: CrmView; label: string }[] = [
  { id: "list", label: "List" },
  { id: "map", label: "Map" },
];

export function CrmChrome({
  scope,
  view,
  filters,
  title,
  description,
  countLabel,
  children,
}: {
  scope: ProspectScope;
  view: CrmView;
  filters: CrmFilters;
  title: string;
  description: string;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {countLabel ? `${countLabel}. ` : null}
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented>
            {VIEWS.map((entry) => (
              <Segment
                key={entry.id}
                href={crmHref({ scope, view: entry.id, filters })}
                active={view === entry.id}
                label={entry.label}
              />
            ))}
          </Segmented>
          <Segmented>
            {SCOPES.map((entry) => (
              <Segment
                key={entry}
                href={crmHref({
                  scope: entry,
                  view,
                  filters: {
                    ...filters,
                    // Stage groups differ across scopes — reset when switching.
                    stage: "",
                    stageGroup: "",
                    includeDnc: entry === "leads" ? filters.includeDnc : "",
                  },
                })}
                active={scope === entry}
                label={SCOPE_LABELS[entry]}
              />
            ))}
          </Segmented>
        </div>
      </div>
      {children}
    </div>
  );
}

function Segmented({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-card p-1 ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

function Segment({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition sm:text-sm ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
