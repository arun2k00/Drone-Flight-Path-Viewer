import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import logo from "./aeroxpress-logo.png";

/** The Aeroxpress wordmark (the drone mark is the "X"). Height is set by className; width follows the aspect ratio. */
export function LogoImage({ className }: { className?: string }) {
  return <Image src={logo} alt="Aeroxpress" priority className={cn("h-6 w-auto", className)} />;
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center" aria-label="Aeroxpress home">
      <LogoImage className={className} />
    </Link>
  );
}
