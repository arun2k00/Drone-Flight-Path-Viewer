import { cn } from "@/lib/utils";
import { activityLabel, activityTone } from "@/lib/admin/activity-labels";

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  danger: "bg-destructive/10 text-destructive",
  admin: "bg-chart-2/10 text-chart-2",
  success: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
};

export function ActivityBadge({ action }: { action: string }) {
  return <span className={cn("inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[activityTone(action)])}>{activityLabel(action)}</span>;
}

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

export const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
export const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
