import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in" };

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">AI Transformation</p>
      <h1 className="text-2xl font-medium">Sign in required</h1>
      <p className="text-sm text-muted-foreground">Use the shared ops password to open the hub.</p>
      <Button asChild variant="outline" className="w-fit">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </main>
  );
}
