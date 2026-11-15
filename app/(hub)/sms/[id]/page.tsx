import Link from "next/link";
import { notFound } from "next/navigation";
import { markSmsClosed, setSmsBotPaused } from "@/app/actions/sms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "SMS Conversation" };

type Conversation = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  summary: string | null;
  last_message_at: string;
  bot_paused: boolean;
  opted_out: boolean;
  created_at: string;
};

type Message = {
  id: string;
  direction: string;
  body: string;
  created_at: string;
};

export default async function SmsConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireOwner();

  const [{ data: conversation, error: convError }, { data: messages, error: msgError }] =
    await Promise.all([
      supabase.from("sms_conversations").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("sms_messages")
        .select("id, direction, body, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
    ]);

  if (convError) throw new Error(convError.message);
  if (msgError) throw new Error(msgError.message);
  if (!conversation) notFound();

  const row = conversation as Conversation;
  const transcript = (messages ?? []) as Message[];
  const paused = row.bot_paused || row.status === "needs_human";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/sms" className="hover:underline">
            SMS Inbox
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {row.name || row.phone}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.phone}
              {row.summary ? ` · ${row.summary}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={row.status === "needs_human" ? "destructive" : "secondary"}>
              {row.status.replaceAll("_", " ")}
            </Badge>
            {row.bot_paused ? <Badge variant="outline">Bot paused</Badge> : null}
            {row.opted_out ? <Badge variant="outline">Opted out</Badge> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
        <form action={setSmsBotPaused}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="paused" value={paused ? "false" : "true"} />
          <Button type="submit" variant={paused ? "default" : "outline"} size="sm">
            {paused ? "Resume bot" : "Pause bot / take over"}
          </Button>
        </form>
        <form action={markSmsClosed}>
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" variant="ghost" size="sm">
            Mark closed
          </Button>
        </form>
        <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:self-center">
          Last message {formatWhen(row.last_message_at)}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        {transcript.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages stored yet.</p>
        ) : (
          transcript.map((message) => {
            const inbound = message.direction === "inbound";
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-1 ${inbound ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    inbound
                      ? "bg-foreground/5 text-foreground"
                      : "bg-ink text-paper"
                  }`}
                >
                  {message.body}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {inbound ? "Lead" : message.direction === "system" ? "System" : "Assistant"} ·{" "}
                  {formatWhen(message.created_at)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
