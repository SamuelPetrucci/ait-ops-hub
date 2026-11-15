import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Sign in" };

function safeNext(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main className="ait-grid relative flex min-h-screen items-center justify-center px-4">
      <div className="panel relative w-full max-w-md overflow-hidden rounded-3xl px-6 py-7 ring-1 ring-ink/10">
        <div className="mesh" aria-hidden>
          <span />
          <span />
        </div>
        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <span className="relative flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#0c1a17,#1a3d35)] text-sm font-semibold text-paper">
              A
              <span className="absolute inset-x-1.5 top-1/2 h-0.5 -translate-y-1/2 bg-signal-bright" />
            </span>
            <div>
              <p className="text-[11px] tracking-[0.18em] text-signal uppercase">AI Transformation</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Ops Hub</h1>
            </div>
          </div>
          <p className="mb-5 text-sm text-ink-soft">
            One shared password for the ops team. The hub stays private.
          </p>
          {params.error ? <p className="mb-4 text-sm text-destructive">{params.error}</p> : null}
          <form action={signIn} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                className="bg-white/70"
              />
            </div>
            <Button type="submit" className="mt-1 rounded-full bg-ink text-paper hover:bg-ink/90">
              Enter hub
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
