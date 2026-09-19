import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/brand/Logo";
import { ManagedBy } from "@/components/brand/ManagedBy";
import { getSiteSettings } from "@/lib/site/settings.server";

export const metadata: Metadata = { title: "Privacy · Aeroxpress" };

const SECTIONS: Array<[string, string[]]> = [
  [
    "What we store",
    [
      "Your account: name, email address and a salted scrypt hash of your password. We never store the password itself.",
      "Your projects: the videos, SRT flight logs and logos you upload, the files Aeroxpress derives from them (telemetry, flight paths, exports) and your overlay settings.",
      "Share links: who created them, the optional client name, email and message, the expiry date, and how often they were opened.",
      "An activity log (sign-ins, projects, exports, sharing) with the IP address reported by our proxy, so administrators can investigate misuse.",
    ],
  ],
  [
    "The Flight Viewer",
    [
      "The Flight Viewer at /viewer reads your SRT and plays your video inside your browser. Neither file is uploaded.",
      "Map tiles are loaded from OpenStreetMap (map view) and Esri (satellite view). Those providers can see which map area is displayed, but not your files or telemetry.",
    ],
  ],
  [
    "Client share links",
    [
      "Anyone who has a share link can watch that project until the link expires or is revoked. Links use long random tokens and ask search engines not to index them.",
      "Revoking a link, suspending an account, or deleting a project stops the link working immediately.",
    ],
  ],
  [
    "Email",
    ["We send transactional email only: welcome, password reset and change notices, export results, share invitations you request, and notices when a client opens your link."],
  ],
  [
    "Deleting your data",
    [
      "Deleting a project removes its uploads, exports and share links. An administrator can delete your whole account and everything in it on request.",
    ],
  ],
];

export default async function PrivacyPage() {
  await connection();
  const { contactEmail } = await getSiteSettings();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-3 text-lg text-muted-foreground">How Aeroxpress handles your account, your footage and your clients.</p>
        {SECTIONS.map(([title, items]) => (
          <section key={title} className="mt-10">
            <h2 className="text-lg font-semibold">{title}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed text-muted-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        {contactEmail && (
          <p className="mt-12 text-muted-foreground">
            Questions:{" "}
            <a href={`mailto:${contactEmail}`} className="font-medium text-primary hover:underline">
              {contactEmail}
            </a>
          </p>
        )}
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aeroxpress · <ManagedBy />
      </footer>
    </div>
  );
}
