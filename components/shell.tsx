"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/mutations";
import { CommandPalette } from "@/components/command-palette";
import { RealtimeRefresh } from "@/components/realtime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV } from "@/lib/constants";

export function Shell({
  email,
  badges,
  children,
}: {
  email: string;
  badges: { leads: number; content: number; approvals: number };
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="ait-grid relative min-h-screen overflow-x-hidden">
      <RealtimeRefresh />
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/80 backdrop-blur-xl">
        <div className="relative mx-auto flex w-full max-w-7xl items-center gap-3 px-3 py-3 md:px-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#0c1a17,#1a3d35)] text-sm font-semibold text-paper shadow-[0_8px_20px_rgba(15,143,117,0.25)]">
              A
              <span className="absolute inset-x-1.5 top-1/2 h-0.5 -translate-y-1/2 bg-signal-bright" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-semibold tracking-tight text-ink">AI Transformation</span>
              <span className="block text-[11px] tracking-[0.14em] text-ink-soft uppercase">Ops Hub</span>
            </span>
          </Link>
          <div className="mx-auto w-full max-w-xl">
            <CommandPalette variant="bar" />
          </div>
          <Account email={email} />
        </div>
        <nav className="relative mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-3 pb-3 md:px-5">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const count = badgeFor(item.href, badges);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
                  active
                    ? "bg-ink text-paper shadow-sm"
                    : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {item.label}
                {count > 0 ? (
                  <span className="rounded-full bg-signal/15 px-1.5 text-[11px] tabular-nums text-signal">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="relative flex w-full flex-col gap-5 px-3 py-5 md:gap-6 md:px-5 md:py-7">
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 md:gap-6">{children}</div>
      </main>
    </div>
  );
}

function Account({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 max-w-36 shrink-0 items-center rounded-full bg-white/60 px-3 text-sm text-ink-soft outline-none ring-1 ring-ink/10 hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-signal">
        <span className="truncate">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-52 truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/profile" className="block rounded-md px-1.5 py-1 text-sm hover:bg-muted">
          Profile
        </Link>
        <Link href="/integrations" className="block rounded-md px-1.5 py-1 text-sm hover:bg-muted">
          Integrations
        </Link>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <button type="submit" className="w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted">
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function badgeFor(href: string, badges: { leads: number; content: number; approvals: number }) {
  if (href === "/leads") return badges.leads;
  if (href === "/content") return badges.content;
  if (href === "/approvals") return badges.approvals;
  return 0;
}
