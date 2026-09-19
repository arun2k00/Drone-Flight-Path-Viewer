"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { FormAlert } from "@/components/auth/AuthForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveSiteSettingsAction } from "@/lib/admin/actions";
import type { SiteSettings } from "@/lib/site/settings.server";

const TEXT_FIELDS: Array<{ name: keyof SiteSettings; label: string; hint: string; multiline?: boolean; max: number }> = [
  { name: "announcement", label: "Announcement bar", hint: "Shown above the landing page navigation. Leave empty to hide it.", max: 160 },
  { name: "heroEyebrow", label: "Hero eyebrow", hint: "Small line above the headline.", max: 60 },
  { name: "heroTitle", label: "Hero headline", hint: "The main promise, in one line.", max: 120 },
  { name: "heroSubtitle", label: "Hero description", hint: "One or two sentences under the headline.", multiline: true, max: 320 },
  { name: "ctaPrimary", label: "Primary button", hint: "Leads to sign up.", max: 30 },
  { name: "ctaSecondary", label: "Secondary button", hint: "Leads to the free Flight Viewer.", max: 30 },
  { name: "contactEmail", label: "Contact email", hint: "Shown in the footer and FAQ. Leave empty to hide it.", max: 200 },
];

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveSiteSettingsAction, {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <FormAlert state={state} />
      <section className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <Label htmlFor="signupsOpen" className="text-sm font-semibold">
            Allow new signups
          </Label>
          <p className="text-sm text-muted-foreground">When off, only the address in ADMIN_EMAIL can create an account.</p>
        </div>
        <Switch id="signupsOpen" name="signupsOpen" defaultChecked={settings.signupsOpen} />
      </section>

      <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Landing page copy</h2>
          <Link href="/" target="_blank" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View page <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        {TEXT_FIELDS.map((f) => {
          const error = state.fieldErrors?.[f.name]?.[0];
          const common = {
            id: f.name,
            name: f.name,
            defaultValue: state.values?.[f.name] ?? String(settings[f.name]),
            maxLength: f.max,
            "aria-invalid": error ? true : undefined,
          };
          return (
            <div key={f.name} className="flex flex-col gap-1.5">
              <Label htmlFor={f.name}>{f.label}</Label>
              {f.multiline ? (
                <textarea
                  {...common}
                  rows={3}
                  className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                />
              ) : (
                <Input {...common} type={f.name === "contactEmail" ? "email" : "text"} className="h-9" />
              )}
              <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{error ?? f.hint}</p>
            </div>
          );
        })}
      </section>

      <Button type="submit" disabled={pending} className="self-start">
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        Save changes
      </Button>
    </form>
  );
}
