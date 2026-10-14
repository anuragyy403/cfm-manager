"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const emailSchema = z.email("Enter a valid email address.").trim().toLowerCase();

export function ForgotPasswordForm() {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(new FormData(e.currentTarget).get("email"));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    setFieldError(null);

    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email: parsed.data });
    setPending(false);

    if (error) {
      setError(
        error.status === 429
          ? "Too many requests. Please wait a few minutes and try again."
          : "Something went wrong. Please try again.",
      );
      return;
    }
    // Same message whether or not an account exists, so this page can't be
    // used to find out who has an account.
    setSentTo(parsed.data);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-orange-soft text-brand-orange">
          <MailCheck className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            If an account exists for <strong className="text-foreground">{sentTo}</strong>, we&apos;ve sent a
            link to reset the password. It expires in 1 hour.
          </p>
          <p className="text-sm text-muted-foreground">
            Nothing arrived after a few minutes? Check your spam folder, or ask your manager to send you a
            reset email.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">
            <ArrowLeft />
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Forgot your password?</h2>
        <p className="text-sm text-muted-foreground">
          Enter the email you signed up with and we&apos;ll send you a link to choose a new one.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!fieldError}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={!!fieldError}
            />
            <FieldError>{fieldError}</FieldError>
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
