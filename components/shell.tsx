"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { signOut } from "@/app/actions/mutations";
import { CommandPalette } from "@/components/command-palette";
import { RealtimeRefresh } from "@/components/realtime";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV } from "@/lib/constants";

export function Shell({
  email,
  badges,
  children,
}: {
  email: string;
  badges: { approvals: number; followUps: number };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[220px_1fr]">
      <RealtimeRefresh />
      <aside className="hidden border-r border-border md:flex md:flex-col">
        <Brand />
        <Nav badges={badges} />
        <Account email={email} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/90 px-3 py-2 backdrop-blur md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>AIT Ops Hub</SheetTitle>
              </SheetHeader>
              <Nav badges={badges} />
              <Account email={email} />
            </SheetContent>
          </Sheet>
          <p className="text-sm font-medium md:hidden">AIT Ops Hub</p>
          <div className="ml-auto">
            <CommandPalette />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="px-4 py-4">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">AI Transformation</p>
      <p className="text-base font-medium">Ops Hub</p>
    </div>
  );
}

function Nav({ badges }: { badges: { approvals: number; followUps: number } }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const count = item.href === "/approvals" ? badges.approvals : item.href === "/follow-ups" ? badges.followUps : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
          >
            {item.label}
            {count > 0 ? <span className="text-xs tabular-nums text-primary">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ email }: { email: string }) {
  return (
    <form action={signOut} className="mt-auto border-t border-border p-3">
      <p className="truncate text-xs text-muted-foreground">{email}</p>
      <Button type="submit" variant="ghost" size="sm" className="mt-1 px-0">
        Sign out
      </Button>
    </form>
  );
}
