"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { newPasswordSchema } from "@/lib/validation";

type FieldErrors = Partial<Record<"newPassword" | "confirmPassword", string>>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<React.ReactNode>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = newPasswordSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        errs[key] ??= issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.newPassword, token });
    setPending(false);

    if (error) {
      if (error.code === "INVALID_TOKEN") {
        setError(
          <>
            This link has expired or was already used.{" "}
            <Link href="/forgot-password" className="font-medium underline">
              Send a new link
            </Link>
            .
          </>,
        );
      } else if (error.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(error.message || "Could not change your password. Please try again.");
      }
      return;
    }
    router.replace("/sign-in?reset=1");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
        <p className="text-sm text-muted-foreground">
          After this you&apos;ll be signed out on every device and can sign in with the new password.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!fieldErrors.newPassword}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={!!fieldErrors.newPassword}
            />
            {fieldErrors.newPassword ? (
              <FieldError>{fieldErrors.newPassword}</FieldError>
            ) : (
              <FieldDescription>At least 8 characters.</FieldDescription>
            )}
          </Field>
          <Field data-invalid={!!fieldErrors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save new password
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
