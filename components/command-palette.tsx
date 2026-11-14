"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchHub } from "@/app/actions/mutations";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV } from "@/lib/constants";
import { companyOf } from "@/lib/format";

type Hit = { href: string; label: string; hint: string };

export function CommandPalette({ variant = "button" }: { variant?: "button" | "bar" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ companies: Hit[]; deals: Hit[]; agents: Hit[]; content: Hit[] }>({
    companies: [],
    deals: [],
    agents: [],
    content: [],
  });
  const [, startTransition] = useTransition();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await searchHub(query);
        setHits({
          companies: result.companies.map((row) => ({
            href: `/companies/${row.id}`,
            label: row.company,
            hint: String(row.stage).replaceAll("_", " "),
          })),
          deals: result.deals.map((row) => ({
            href: `/companies/${row.prospect_id}`,
            label: `${companyOf(row)} · ${row.service}`,
            hint: String(row.status).replaceAll("_", " "),
          })),
          agents: result.agents.map((row) => ({
            href: `/agents/${row.id}`,
            label: row.name,
            hint: row.role || row.status,
          })),
          content: result.content.map((row) => ({
            href: `/content/${row.id}`,
            label: row.title || row.content_id || "Untitled",
            hint: [row.content_id, String(row.status).replaceAll("_", " ")].filter(Boolean).join(" · "),
          })),
        });
      });
    }, 180);
    return () => clearTimeout(handle);
  }, [open, query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {variant === "bar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-full items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 text-left text-sm text-white/55 outline-none hover:border-white/20 hover:bg-black/45 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-amber-300/60"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">Search companies, content, deals, agents…</span>
          <kbd className="hidden rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-white/45 sm:inline">
            Ctrl K
          </kbd>
        </button>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="hidden sm:inline-flex">
            <Search />
            Search
            <span className="text-xs text-muted-foreground">Ctrl K</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setOpen(true)} className="sm:hidden" aria-label="Search">
            <Search />
          </Button>
        </>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} title="Jump" description="Companies, content, deals, and agents">
        <Command>
          <CommandInput
            placeholder="Jump to a company, piece, deal, or agent"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {["Hub", "Business", "Content", "Operations"].map((heading) => {
              const items = NAV.filter((item) => (("group" in item && item.group) || "Hub") === heading);
              if (items.length === 0) return null;
              return (
                <CommandGroup key={heading} heading={heading === "Hub" ? "Go to" : heading}>
                  {items.map((item) => (
                    <CommandItem key={item.href} value={`${heading} ${item.label}`} onSelect={() => go(item.href)}>
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <HitGroup heading="Companies" hits={hits.companies} onSelect={go} />
            <HitGroup heading="Content" hits={hits.content} onSelect={go} />
            <HitGroup heading="Deals" hits={hits.deals} onSelect={go} />
            <HitGroup heading="Agents" hits={hits.agents} onSelect={go} />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function HitGroup({
  heading,
  hits,
  onSelect,
}: {
  heading: string;
  hits: Hit[];
  onSelect: (href: string) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {hits.map((hit) => (
        <CommandItem key={hit.href + hit.label} value={`${hit.label} ${hit.hint}`} onSelect={() => onSelect(hit.href)}>
          <span className="truncate">{hit.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">{hit.hint}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
