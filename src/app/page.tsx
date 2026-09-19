import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  BarChart3,
  Clapperboard,
  Clock,
  Download,
  FileVideo,
  GraduationCap,
  HardHat,
  Layers,
  Link2,
  Lock,
  Map as MapIcon,
  MapPinned,
  MonitorSmartphone,
  PlayCircle,
  ServerCog,
  ShieldCheck,
  Sprout,
  Upload,
  UtilityPole,
} from "lucide-react";
import { GitHubLink } from "@/components/brand/GitHubLink";
import { Logo } from "@/components/brand/Logo";
import { ManagedBy } from "@/components/brand/ManagedBy";
import { REPO_URL } from "@/lib/site/links";
import { ProductMock } from "@/components/landing/ProductMock";
import { getCurrentUser } from "@/lib/auth/session.server";
import { getSiteSettings } from "@/lib/site/settings.server";

export const metadata: Metadata = {
  title: "Aeroxpress · Drone video with its flight data, ready to share",
  description:
    "Pair DJI video with its SRT flight log. Play footage next to the live flight path, altitude and speed, share it with clients by link, or export an MP4 with the telemetry burned in.",
  openGraph: {
    title: "Aeroxpress",
    description: "Show clients exactly where the drone was. DJI video + SRT telemetry, synchronized and shareable.",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: MapIcon,
    title: "Flight path, synced to the frame",
    text: "Every moment of the video maps to a GPS position. Scrub the video and the drone moves on the map; click the map and the video jumps there.",
  },
  {
    icon: Layers,
    title: "Overlays burned into the MP4",
    text: "Place a telemetry panel, mini-map, heading indicator, logo and markers on the frame, then export a video that plays anywhere.",
  },
  {
    icon: BarChart3,
    title: "Altitude and speed graphs",
    text: "Optional graph widgets show the whole flight profile with a live cursor, in the browser and in the exported video.",
  },
  {
    icon: Link2,
    title: "Temporary client links",
    text: "Send a link that opens in any browser: no client account, no dashboard. Links expire on their own and you can revoke them anytime.",
  },
  {
    icon: FileVideo,
    title: "Reads real DJI flight logs",
    text: "Bracket-style logs from Mini, Air and Mavic, older GPS(…) logs from Phantom and Inspire, and Enterprise logs with gimbal data.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    text: "The free Flight Viewer plays files straight from your device and uploads nothing. Shared projects are only reachable through their link.",
  },
];

const STEPS = [
  { icon: Upload, title: "Drop the MP4 and SRT", text: "Take both files from the drone's SD card. Matching names like DJI_0042.MP4 and DJI_0042.SRT pair automatically." },
  { icon: Layers, title: "Check the flight, design the overlay", text: "Aeroxpress parses the flight log, validates GPS, and shows you the path, stats and a live preview of your widgets." },
  { icon: Link2, title: "Share a link or export", text: "Email your client a temporary link, or export an MP4 with the telemetry embedded, to share however you like." },
];

const AUDIENCES = [
  { icon: MapPinned, title: "Survey & mapping", text: "Hand over every flight with its exact track, altitude and GPS coverage, not just the footage." },
  { icon: UtilityPole, title: "Infrastructure inspection", text: "Jump to the second a defect appears and show exactly where on the asset it was filmed." },
  { icon: HardHat, title: "Construction progress", text: "Fly the same route every week and send stakeholders a link that shows what changed and where." },
  { icon: Clapperboard, title: "Real estate & film", text: "Deliver clips with altitude, speed and a mini-map burned in, ready for listings and edits." },
  { icon: Sprout, title: "Agriculture", text: "Tie crop observations to field positions and heights, and share them with agronomists by link." },
  { icon: GraduationCap, title: "Training & incident review", text: "Replay a flight second by second with altitude, speed and heading to debrief pilots." },
];

const FAQ = [
  {
    q: "Which files do I need?",
    a: "The MP4 (or MOV) video and the .SRT file your DJI drone writes next to it. Turn on “Video captions” in DJI Fly or DJI Pilot so the SRT is recorded. An SRT on its own is enough to see the flight path in the Flight Viewer.",
  },
  {
    q: "Which drones are supported?",
    a: "Any DJI drone that writes an SRT flight log: the bracket format used by Mini, Air, Mavic and Avata models, the older GPS(…) format from Phantom and Inspire, and Matrice/Enterprise logs. Unknown fields are ignored instead of breaking the import.",
  },
  {
    q: "Do my clients need an account?",
    a: "No. A share link opens a read-only page in the browser with the video, the synced map, graphs and telemetry. You choose how long it lasts (1 to 30 days) and whether the exported video can be downloaded.",
  },
  {
    q: "Does the Flight Viewer upload my footage?",
    a: "No. The Flight Viewer reads the SRT and plays the video from your device. Only map tiles are fetched from the map provider, which reveals the area you're looking at but not your files.",
  },
  {
    q: "What if my SRT has no GPS?",
    a: "Some recording modes write telemetry without a satellite fix. Aeroxpress says so clearly and still shows altitude, camera settings and the rest of the data it found.",
  },
  {
    q: "Is Aeroxpress open source?",
    a: "Yes. The full source code is on GitHub under the MIT license. Read it, run it, or adapt it to your own workflow.",
  },
  {
    q: "Can we run it on our own servers?",
    a: "Yes. Aeroxpress ships as a Docker image with FFmpeg included, stores everything on a local volume, and sends email through your own SMTP server.",
  },
];

export default async function LandingPage() {
  await connection();
  const [site, user] = await Promise.all([getSiteSettings(), getCurrentUser()]);
  const primaryHref = user ? "/dashboard" : "/signup";
  const primaryLabel = user ? "Open dashboard" : site.ctaPrimary;

  return (
    <div className="flex min-h-screen flex-col bg-background text-[15px]">
      {site.announcement && (
        <div className="bg-[#14181f] px-4 py-2 text-center text-sm text-white">
          {site.announcement}
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#sharing" className="hover:text-foreground">Client sharing</a>
            <a href="#privacy" className="hover:text-foreground">Privacy</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <GitHubLink />
            {!user && (
              <Link href="/login" className="hidden font-medium text-foreground hover:text-primary sm:inline">
                Log in
              </Link>
            )}
            <Link href={primaryHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
              {primaryLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)] opacity-60"
            aria-hidden="true"
          />
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary sm:text-sm">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                {site.heroEyebrow}
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">{site.heroTitle}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">{site.heroSubtitle}</p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={primaryHref} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-medium text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90">
                  {primaryLabel} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/viewer" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-6 font-medium shadow-sm hover:bg-muted">
                  <PlayCircle className="size-4 text-primary" aria-hidden="true" /> {site.ctaSecondary}
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">The Flight Viewer is free and runs in your browser. No upload, no account.</p>
            </div>
            <div className="mt-16">
              <ProductMock />
            </div>
          </div>
        </section>

        {/* Audiences */}
        <section aria-labelledby="built-for" className="relative overflow-hidden border-y border-border bg-card">
          <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold text-primary">Built for</p>
              <h2 id="built-for" className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Teams who fly for a living</h2>
              <p className="mt-4 text-lg text-muted-foreground">Wherever a client needs to know where a shot was taken, Aeroxpress turns the flight log into proof.</p>
            </div>
            <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {AUDIENCES.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="group relative bg-card p-7 transition-colors hover:bg-background">
                  <div className="flex items-start justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f59e0b] to-primary text-white shadow-md shadow-primary/20 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
                  <span className="absolute inset-x-7 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">Features</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Everything the flight log knows, next to the footage</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                DJI records where the drone was for every second of video. Aeroxpress puts that data where people can use it.
              </p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold text-primary">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From SD card to client in three steps</h2>
            </div>
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="relative rounded-2xl border border-border bg-background p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-[#14181f] text-white">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-4xl font-semibold text-border">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Sharing */}
        <section id="sharing" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-primary">Client sharing</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">A link, not another login</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Clients open the flight in their browser: video, live map position, altitude and speed graphs, camera settings. When the job is done, the link expires by itself.
              </p>
              <ul className="mt-8 flex flex-col gap-4">
                {[
                  [Clock, "Expires automatically", "Choose 24 hours up to 30 days. Revoke anytime from the project."],
                  [Download, "Optional download", "Let clients download the exported MP4 with the telemetry burned in, or keep it view-only."],
                  [MonitorSmartphone, "Works on any device", "Phones, tablets and laptops. Nothing to install."],
                  [BarChart3, "Know when it's opened", "You get an email the first time your client views the flight."],
                ].map(([Icon, title, text]) => {
                  const I = Icon as React.ElementType;
                  return (
                    <li key={title as string} className="flex gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <I className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-medium">{title as string}</p>
                        <p className="text-muted-foreground">{text as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="relative" aria-hidden="true">
              <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-primary/15 to-transparent blur-2xl" />
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
                <p className="text-xs font-bold tracking-[0.14em] text-primary">SHARED FLIGHT</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">Ring Road Survey · Pier 14</p>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Hi Arjun, Priya shared drone footage with you. It plays next to the drone&rsquo;s live position on the map, with altitude and speed at every moment.
                </p>
                <div className="mt-4 rounded-r-xl border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm italic">
                  &ldquo;Here&rsquo;s Tuesday&rsquo;s inspection flight. The crack on pier 14 is at 03:20.&rdquo;
                </div>
                <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground">
                  View the flight <ArrowRight className="size-4" />
                </span>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Link valid until</p>
                    <p className="font-medium">26 Sep, 18:00</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Video download</p>
                    <p className="font-medium">Included</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="scroll-mt-20 bg-[#101419] text-white">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#f59e0b]">Privacy &amp; security</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Drone footage is sensitive. We treat it that way.</h2>
              <p className="mt-4 text-lg text-white/65">Industrial sites, private property and critical infrastructure deserve more than a public video link.</p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [Lock, "Local viewer", "The Flight Viewer never uploads your video or flight log. It all runs in your browser."],
                [Link2, "Unguessable links", "Share links use 256-bit random tokens, expire on schedule and are never indexed."],
                [ShieldCheck, "Your projects only", "Each account sees only its own projects. Admin actions are recorded in an audit log."],
                [ServerCog, "Self-hostable", "Run Aeroxpress on your own server with Docker, your own storage and your own SMTP."],
              ].map(([Icon, title, text]) => {
                const I = Icon as React.ElementType;
                return (
                  <div key={title as string} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <I className="size-5 text-[#f59e0b]" aria-hidden="true" />
                    <h3 className="mt-4 font-semibold">{title as string}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{text as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">FAQ</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Questions pilots ask</h2>
            </div>
            <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
            {site.contactEmail && (
              <p className="mt-8 text-center text-muted-foreground">
                Something else?{" "}
                <a href={`mailto:${site.contactEmail}`} className="font-medium text-primary hover:underline">
                  {site.contactEmail}
                </a>
              </p>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(0,0,0,0.18),transparent_50%)]" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Your next flight deserves more than a video file</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Create an account, drop in an MP4 and its SRT, and send your client a link in minutes.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={primaryHref} className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-medium text-[#14181f] shadow-lg hover:bg-white/90">
                  {primaryLabel} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/viewer" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-6 font-medium hover:bg-white/10">
                  {site.ctaSecondary}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">DJI video and SRT flight logs, synchronized, shareable and exportable. Open source.</p>
            <GitHubLink label className="mt-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><Link href="/viewer" className="hover:text-foreground">Flight Viewer</Link></li>
              <li><a href="#sharing" className="hover:text-foreground">Client sharing</a></li>
              <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
              <li><a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Source code</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Account</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link href="/signup" className="hover:text-foreground">Create account</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Log in</Link></li>
              <li><Link href="/forgot-password" className="hover:text-foreground">Reset password</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
              {site.contactEmail && (
                <li>
                  <a href={`mailto:${site.contactEmail}`} className="hover:text-foreground">Contact</a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              © {new Date().getFullYear()} Aeroxpress · <ManagedBy />
            </p>
            <p>DJI is a trademark of SZ DJI Technology Co., Ltd. Aeroxpress is not affiliated with DJI.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
