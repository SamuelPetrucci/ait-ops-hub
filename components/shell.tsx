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

const GROUPS = [
  {
    name: "Business",
    label: "text-amber-300",
    rail: "border-amber-400/50",
    active: "bg-amber-400 text-amber-950",
    idle: "text-amber-50/80 hover:bg-amber-400/15 hover:text-amber-50",
  },
  {
    name: "Content",
    label: "text-cyan-300",
    rail: "border-cyan-400/50",
    active: "bg-cyan-400 text-cyan-950",
    idle: "text-cyan-50/80 hover:bg-cyan-400/15 hover:text-cyan-50",
  },
  {
    name: "Operations",
    label: "text-violet-300",
    rail: "border-violet-400/50",
    active: "bg-violet-400 text-violet-950",
    idle: "text-violet-50/80 hover:bg-violet-400/15 hover:text-violet-50",
  },
] as const;

export function Shell({
  email,
  badges,
  children,
}: {
  email: string;
  badges: { approvals: number; followUps: number; content: number };
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <RealtimeRefresh />
      <header className="sticky top-0 z-30 border-b border-border bg-[#12151c]/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-3 md:px-5">
          <Link href="/" className="shrink-0">
            <p className="text-[11px] tracking-[0.16em] text-amber-300 uppercase">AI Transformation</p>
            <p className="text-sm font-medium leading-none">Ops Hub</p>
          </Link>
          <div className="mx-auto w-full max-w-xl">
            <CommandPalette variant="bar" />
          </div>
          <Account email={email} />
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:px-5">
          <Link
            href="/"
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${pathname === "/" ? "bg-white text-zinc-950" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            Overview
          </Link>
          {GROUPS.map((group) => {
            const items = NAV.filter((item) => "group" in item && item.group === group.name);
            return (
              <div
                key={group.name}
                className={`flex shrink-0 items-center gap-1 rounded-xl border-l-2 ${group.rail} bg-white/4 px-1.5 py-1`}
              >
                <span className={`px-1.5 text-[10px] tracking-[0.14em] uppercase ${group.label}`}>{group.name}</span>
                {items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const count = badgeFor(item.href, badges);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm ${active ? group.active : group.idle}`}
                    >
                      {item.label}
                      {count > 0 ? <span className="text-xs tabular-nums opacity-80">{count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </header>
      <main className="flex w-full flex-col gap-6 px-3 py-5 md:px-5">{children}</main>
    </div>
  );
}

function Account({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 max-w-36 shrink-0 items-center rounded-lg px-2.5 text-sm text-white/70 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2">
        <span className="truncate">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-52 truncate">{email}</DropdownMenuLabel>
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

function badgeFor(href: string, badges: { approvals: number; followUps: number; content: number }) {
  if (href === "/approvals") return badges.approvals;
  if (href === "/follow-ups") return badges.followUps;
  if (href === "/content") return badges.content;
  return 0;
}
