import Link from "next/link";
import { Activity, Route, ShieldCheck } from "lucide-react";
import { GitHubLink } from "@/components/brand/GitHubLink";
import { LogoImage } from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/auth/session.server";
import { UserMenu } from "./UserMenu";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const navLink = "flex items-center gap-1.5 text-muted-foreground hover:text-foreground";

export async function AppHeader({ breadcrumb = [], diagnosticsEnabled }: { breadcrumb?: BreadcrumbItem[]; diagnosticsEnabled: boolean }) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold text-foreground">
          <LogoImage className="h-5 sm:h-6" />
        </Link>
        {breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-muted-foreground sm:flex">
            {breadcrumb.map((item) => (
              <span key={item.label} className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true">›</span>
                {item.href ? (
                  <Link href={item.href} className="truncate hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate text-foreground">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
      <nav className="flex items-center gap-4 text-[13px]">
        <Link href="/viewer" aria-label="Flight Viewer" className={navLink}>
          <Route className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Flight Viewer</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" aria-label="Admin" className={navLink}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}
        {isAdmin && diagnosticsEnabled && (
          <Link href="/diagnostics" aria-label="Diagnostics" className={navLink}>
            <Activity className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Diagnostics</span>
          </Link>
        )}
        <GitHubLink className="hidden sm:inline-flex" />
        {user ? (
          <UserMenu name={user.name} email={user.email} />
        ) : (
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
