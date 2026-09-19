import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WarningDto } from "@/types/api";

export function WarningsList({ warnings }: { warnings: WarningDto[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {warnings.map((w) => (
        <Alert key={w.code} className="border-warning/30">
          <TriangleAlert className="text-warning" aria-hidden="true" />
          <AlertDescription>{w.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
