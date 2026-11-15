import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "SMS Inbox" };

type ConversationRow = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  summary: string | null;
  last_message_at: string;
  bot_paused: boolean;
  opted_out: boolean;
};

function statusLabel(row: ConversationRow) {
  if (row.opted_out || row.status === "opted_out") return "Opted out";
  if (row.status === "needs_human") return "Needs you";
  if (row.bot_paused) return "Bot paused";
  if (row.status === "closed") return "Closed";
  return "Active";
}

function statusVariant(row: ConversationRow): "destructive" | "secondary" | "outline" | "default" {
  if (row.status === "needs_human") return "destructive";
  if (row.bot_paused || row.opted_out) return "secondary";
  if (row.status === "closed") return "outline";
  return "default";
}

export default async function SmsInboxPage() {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("sms_conversations")
    .select("id, phone, name, status, summary, last_message_at, bot_paused, opted_out")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const migrationMissing =
    Boolean(error) &&
    /sms_conversations|does not exist|Could not find the table/i.test(error?.message || "");

  if (error && !migrationMissing) throw new Error(error.message);

  const rows = (data ?? []) as ConversationRow[];
  const needsYou = rows.filter((row) => row.status === "needs_human").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Messaging</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">SMS Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Linq conversations with Samuel&apos;s SMS assistant. Pause the bot to take over a thread.
          </p>
        </div>
        {needsYou > 0 ? (
          <Badge variant="destructive">{needsYou} need you</Badge>
        ) : null}
      </header>

      {migrationMissing ? (
        <div className="rounded-2xl bg-card/50 px-6 py-10 text-center ring-1 ring-foreground/10">
          <p className="text-lg font-medium">Apply the SMS migration first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run <code className="text-xs">supabase/migrations/20261115210000_sms_assistant.sql</code> in
            the form-submissions SQL editor, then refresh.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-card/50 px-6 py-16 text-center ring-1 ring-foreground/10">
          <p className="text-lg font-medium">No SMS conversations yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            After the Linq webhook is connected and someone texts your number, threads show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <ul className="divide-y divide-foreground/10">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/sms/${row.id}`}
                  className="flex flex-col gap-1 px-4 py-3.5 transition hover:bg-foreground/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">
                        {row.name || row.phone}
                      </p>
                      <Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {row.summary || row.phone}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatWhen(row.last_message_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
