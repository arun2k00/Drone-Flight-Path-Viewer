import { MANAGED_BY } from "@/lib/site/links";

export function ManagedBy({ className }: { className?: string }) {
  return (
    <span className={className}>
      Managed by{" "}
      <a href={MANAGED_BY.url} target="_blank" rel="noopener" className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
        {MANAGED_BY.name}
      </a>
    </span>
  );
}
