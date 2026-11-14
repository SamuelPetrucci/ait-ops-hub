import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">AI Transformation</p>
          <CardTitle>Ops Hub</CardTitle>
          <CardDescription>One shared password for the ops team. The hub stays private.</CardDescription>
        </CardHeader>
        <CardContent>
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
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <Button type="submit">Open the hub</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
