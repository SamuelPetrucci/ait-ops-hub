import type { ReactNode } from "react";
import Link from "next/link";

const TABS = [
  { href: "/content", label: "Desk", active: "desk" },
  { href: "/content/trends", label: "Trends", active: "trends" },
  { href: "/content/references", label: "References", active: "references" },
] as const;

export function ContentChrome({
  active,
  title,
  description,
  actions,
  children,
}: {
  active: (typeof TABS)[number]["active"];
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <div className="panel relative overflow-hidden rounded-3xl px-5 py-5 ring-1 ring-ink/10">
        <div className="mesh" aria-hidden>
          <span />
          <span />
        </div>
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-ink-soft uppercase">Content</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
              <p className="mt-1 max-w-xl text-sm text-ink-soft">{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
          <nav
            aria-label="Content sections"
            className="inline-flex max-w-full overflow-x-auto rounded-full bg-white/55 p-1 ring-1 ring-ink/10"
          >
            {TABS.map((tab) => {
              const selected = tab.active === active;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={selected ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${
                    selected ? "bg-ink text-paper shadow-sm" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
