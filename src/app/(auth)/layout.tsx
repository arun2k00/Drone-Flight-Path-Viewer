import { Logo } from "@/components/brand/Logo";
import { FlightArt } from "@/components/brand/FlightArt";
import { ManagedBy } from "@/components/brand/ManagedBy";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Aeroxpress · <ManagedBy />
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#101419] lg:block" aria-hidden="true">
        <FlightArt className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-12 bottom-12 text-white">
          <p className="max-w-md text-2xl font-semibold leading-snug tracking-tight">Where the drone was, when it was there, and what the camera was doing.</p>
          <p className="mt-3 max-w-md text-sm text-white/60">Video, flight path and telemetry in one synchronized view, ready to share with a link.</p>
        </div>
      </aside>
    </div>
  );
}
