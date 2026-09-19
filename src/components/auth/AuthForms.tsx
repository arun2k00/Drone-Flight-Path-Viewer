"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction, type FormState } from "@/lib/auth/actions";

export function Field({
  name,
  label,
  type = "text",
  autoComplete,
  state,
  hint,
  defaultValue,
  aside,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  state: FormState;
  hint?: string;
  defaultValue?: string;
  aside?: React.ReactNode;
}) {
  const errors = state.fieldErrors?.[name];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={name}>{label}</Label>
        {aside}
      </div>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={type === "password" ? undefined : (state.values?.[name] ?? defaultValue)}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${name}-error` : undefined}
        className="h-10"
        required
      />
      {errors ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function FormAlert({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    );
  return null;
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <>
      <Heading
        title="Welcome back"
        subtitle={
          <>
            New to Aeroxpress?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        }
      />
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <FormAlert state={state} />
        <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          state={state}
          aside={
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        />
        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>
    </>
  );
}

export function SignupForm({ next, closed }: { next: string; closed: boolean }) {
  const [state, action, pending] = useActionState(signupAction, {});
  return (
    <>
      <Heading
        title="Create your account"
        subtitle={
          <>
            Already have one?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      />
      {closed && <p className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">New signups are currently closed.</p>}
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <FormAlert state={state} />
        <Field name="name" label="Full name" autoComplete="name" state={state} />
        <Field name="email" label="Work email" type="email" autoComplete="email" state={state} />
        <Field name="password" label="Password" type="password" autoComplete="new-password" state={state} hint="At least 10 characters, with a letter and a number." />
        <SubmitButton pending={pending}>Create account</SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to how we handle your data in our{" "}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>
          .
        </p>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  return (
    <>
      <Heading title="Reset your password" subtitle="Enter your account email and we'll send you a link to choose a new password." />
      <form action={action} className="flex flex-col gap-4">
        <FormAlert state={state} />
        <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
        <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </form>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  return (
    <>
      <Heading title="Choose a new password" subtitle="You'll be signed in on this device and signed out everywhere else." />
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <FormAlert state={state} />
        <Field name="password" label="New password" type="password" autoComplete="new-password" state={state} hint="At least 10 characters, with a letter and a number." />
        <SubmitButton pending={pending}>Save password</SubmitButton>
      </form>
    </>
  );
}
