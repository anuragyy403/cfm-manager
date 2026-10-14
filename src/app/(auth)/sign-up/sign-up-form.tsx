"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "At least 3 characters.")
      .max(30, "At most 30 characters.")
      .regex(/^[a-z0-9_.]+$/, "Use letters, numbers, dots or underscores."),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    password: z.string().min(8, "At least 8 characters.").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

type FieldErrors = Partial<Record<keyof z.infer<typeof signUpSchema>, string>>;

const errorMessages: Record<string, string> = {
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists.",
  USERNAME_IS_ALREADY_TAKEN: "That username is taken. Try another one.",
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: "That username is taken. Try another one.",
};

export function SignUpForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = signUpSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    );
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

    const { name, username, email, password } = parsed.data;
    setPending(true);
    const { error } = await authClient.signUp.email({
      name,
      username,
      displayUsername: username,
      email,
      password,
    });
    setPending(false);

    if (error) {
      setError(
        (error.code && errorMessages[error.code]) ||
          error.message ||
          "Could not create your account. Please try again.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
        <p className="text-sm text-muted-foreground">
          Your manager can add you to their team once you&apos;ve signed up.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={!!fieldErrors.name}>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input id="name" name="name" autoComplete="name" autoFocus aria-invalid={!!fieldErrors.name} />
            <FieldError>{fieldErrors.name}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.username}>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input id="username" name="username" autoComplete="username" aria-invalid={!!fieldErrors.username} />
            {fieldErrors.username ? (
              <FieldError>{fieldErrors.username}</FieldError>
            ) : (
              <FieldDescription>Your manager will search for you by name or username.</FieldDescription>
            )}
          </Field>
          <Field data-invalid={!!fieldErrors.email}>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!fieldErrors.email} />
            <FieldError>{fieldErrors.email}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput id="password" name="password" autoComplete="new-password" aria-invalid={!!fieldErrors.password} />
            <FieldError>{fieldErrors.password}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" aria-invalid={!!fieldErrors.confirmPassword} />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Create account
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
