import Link from "next/link";
import { Button } from "@/components/ui";
import { ShuttlecockIcon, ArrowLeft } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <ShuttlecockIcon className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <h2 className="mt-2 text-xl font-semibold">Page not found</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The court or page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link href="/app">
          <Button className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Return to app
          </Button>
        </Link>
      </div>
    </main>
  );
}
