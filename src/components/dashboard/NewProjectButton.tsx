import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewProjectButton() {
  return (
    <Button asChild>
      <Link href="/projects/new">
        <Plus className="size-4" aria-hidden="true" />
        New Project
      </Link>
    </Button>
  );
}
