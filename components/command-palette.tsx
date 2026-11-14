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

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ companies: Hit[]; deals: Hit[]; agents: Hit[] }>({
    companies: [],
    deals: [],
    agents: [],
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="hidden sm:inline-flex">
        <Search />
        Search
        <span className="text-xs text-muted-foreground">Ctrl K</span>
      </Button>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} className="sm:hidden" aria-label="Search">
        <Search />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Jump" description="Companies, deals, and agents">
        <Command>
          <CommandInput
            placeholder="Jump to a company, deal, or agent"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Go to">
              {NAV.map((item) => (
                <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <HitGroup heading="Companies" hits={hits.companies} onSelect={go} />
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
