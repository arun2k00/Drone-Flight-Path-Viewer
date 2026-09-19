import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import { ManagedBy } from "@/components/brand/ManagedBy";
import sketch from "@/components/brand/auth-survey-sketch.jpg";

const POINTS = ["GPS sync", "Client links", "MP4 overlays"];

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

      {/* Showcase panel: the square sketch is contained (never cropped); a compact glass card floats over its foreground. */}
      <aside className="hidden p-4 lg:block">
        <div className="relative h-full min-h-[600px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-30px_rgba(20,24,31,0.35)] ring-1 ring-black/5">
          <Image
            src={sketch}
            alt="Hand-drawn survey of a highway and railway corridor, with a drone's flight path, GPS readout and inspection points"
            fill
            priority
            placeholder="blur"
            sizes="50vw"
            className="object-contain object-top px-6 pt-6 pb-28 xl:px-10 xl:pt-10"
          />
          {/* Colour for the glass to pick up. */}
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-[#f59e0b]/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-10 -bottom-28 size-80 rounded-full bg-sky-400/25 blur-3xl" aria-hidden="true" />

          <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/70 bg-white/45 p-5 shadow-[0_20px_50px_-20px_rgba(20,24,31,0.45)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 xl:inset-x-10 xl:bottom-10 xl:p-6">
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Flight log to field report
            </p>
            <h2 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-[#14181f] xl:text-2xl">Every frame, pinned to its exact spot.</h2>
            <p className="mt-1 text-sm text-[#3b4452]">Footage and GPS, synced in one shareable view.</p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {POINTS.map((p) => (
                <li key={p} className="rounded-full border border-white/80 bg-white/60 px-2.5 py-0.5 text-xs font-medium text-[#14181f]/80">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
