import Link from "next/link";
import { Link2Off } from "lucide-react";
import { LogoImage } from "@/components/brand/Logo";

/** Expired, revoked or unknown share links (HTTP 404). */
export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Link2Off className="size-6 text-muted-foreground" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">This link is no longer available</h1>
      <p className="max-w-md text-muted-foreground">Shared flights are temporary. Ask the person who sent it for a new link.</p>
      <Link href="/" className="mt-2 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <LogoImage className="h-5" />
      </Link>
    </main>
  );
}
