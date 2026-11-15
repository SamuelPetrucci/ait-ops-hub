"use client";

import { useState, type ReactNode } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV } from "@/lib/constants";

export function Shell({
  email,
  badges,
  children,
}: {
  email: string;
  badges: { leads: number; content: number; approvals: number; sms: number };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="ait-grid relative min-h-screen overflow-x-hidden">
      <RealtimeRefresh />
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/80 backdrop-blur-xl">
        <div className="relative mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:gap-3 md:px-5">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink md:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
              <span className="sr-only">Menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-ink/10 p-4">
                <SheetTitle className="flex items-center gap-2.5">
                  <span className="relative flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(145deg,#0c1a17,#1a3d35)] text-xs font-semibold text-paper">
                    A
                    <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-signal-bright" />
                  </span>
                  <span className="text-sm font-semibold">Ops Hub</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {NAV.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const count = badgeFor(item.href, badges);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                        active
                          ? "bg-ink text-paper"
                          : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                      }`}
                    >
                      <span>{item.label}</span>
                      {count > 0 ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? "bg-paper/20 text-paper" : "bg-signal/15 text-signal"}`}>
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto border-t border-ink/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
                >
                  Profile
                </Link>
                <Link
                  href="/integrations"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
                >
                  Integrations
                </Link>
                <form action={signOut}>
                  <button type="submit" className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">
                    Sign out
                  </button>
                </form>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="relative flex size-8 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#0c1a17,#1a3d35)] text-xs font-semibold text-paper shadow-[0_8px_20px_rgba(15,143,117,0.25)] sm:size-9 sm:text-sm">
              A
              <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-signal-bright sm:inset-x-1.5" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-sm font-semibold tracking-tight text-ink">AI Transformation</span>
              <span className="block text-[11px] tracking-[0.14em] text-ink-soft uppercase">Ops Hub</span>
            </span>
          </Link>
          <div className="mx-auto hidden w-full max-w-xl sm:block">
            <CommandPalette variant="bar" />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <div className="sm:hidden">
              <CommandPalette variant="icon" />
            </div>
            <Account email={email} />
          </div>
        </div>
        <nav className="relative mx-auto hidden w-full max-w-7xl gap-1 overflow-x-auto px-3 pb-3 md:flex md:px-5">
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
      <main className="relative flex w-full flex-col gap-4 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:gap-5 sm:py-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:gap-6 md:px-5 md:py-7 md:pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5 md:gap-6">{children}</div>
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

function badgeFor(
  href: string,
  badges: { leads: number; content: number; approvals: number; sms: number },
) {
  if (href === "/leads") return badges.leads;
  if (href === "/content") return badges.content;
  if (href === "/approvals") return badges.approvals;
  if (href === "/sms") return badges.sms;
  return 0;
}
