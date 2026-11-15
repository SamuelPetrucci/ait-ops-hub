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
  badges: { leads: number; content: number };
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(90%_60%_at_50%_-10%,rgba(251,191,36,0.07),transparent_55%),var(--background)]">
      <RealtimeRefresh />
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0f1218]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-3 py-3 md:px-5">
          <Link href="/" className="shrink-0">
            <p className="text-[11px] tracking-[0.16em] text-amber-300 uppercase">AI Transformation</p>
            <p className="text-sm font-medium leading-none">Ops Hub</p>
          </Link>
          <div className="mx-auto w-full max-w-xl">
            <CommandPalette variant="bar" />
          </div>
          <Account email={email} />
        </div>
        <nav className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-3 pb-3 md:px-5">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const count = badgeFor(item.href, badges);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${
                  active ? "bg-white text-zinc-950 shadow-sm" : "text-white/65 hover:bg-white/8 hover:text-white"
                }`}
              >
                {item.label}
                {count > 0 ? <span className="text-xs tabular-nums opacity-80">{count}</span> : null}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex w-full flex-col gap-6 px-3 py-6 md:px-5 md:py-8">{children}</main>
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

function badgeFor(href: string, badges: { leads: number; content: number }) {
  if (href === "/leads") return badges.leads;
  if (href === "/content") return badges.content;
  return 0;
}
