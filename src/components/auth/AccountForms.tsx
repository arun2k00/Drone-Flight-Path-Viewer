"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changePasswordAction, updateProfileAction } from "@/lib/auth/actions";
import { Field, FormAlert } from "./AuthForms";

const card = "rounded-xl border border-border bg-card p-6 shadow-sm";

function Save({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {label}
    </Button>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Your name appears on share links and in emails to clients.</p>
      </div>
      <FormAlert state={state} />
      <Field name="name" label="Full name" autoComplete="name" state={state} defaultValue={name} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{email}</p>
      </div>
      <Save pending={pending} label="Save profile" />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-semibold">Password</h2>
        <p className="text-sm text-muted-foreground">Changing it signs you out on every other device.</p>
      </div>
      <FormAlert state={state} />
      <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password" state={state} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" state={state} hint="At least 10 characters, with a letter and a number." />
      <Save pending={pending} label="Change password" />
    </form>
  );
}
