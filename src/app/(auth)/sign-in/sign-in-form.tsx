"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { APP_NAME } from "@/components/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function SignInForm({ passwordReset = false }: { passwordReset?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const identifier = String(form.get("identifier") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setPending(true);
    const { error } = identifier.includes("@")
      ? await authClient.signIn.email({ email: identifier, password })
      : await authClient.signIn.username({ username: identifier, password });
    setPending(false);

    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : "Incorrect email/username or password.",
      );
      return;
    }
    // The home route redirects to the right dashboard for the user's role.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="space-y-3">
        <span className="inline-flex rounded-md bg-[#f3e6bf] px-2.5 py-1 text-xs font-medium text-[#5b4a1c]">
          Team sign-in
        </span>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-[#0a2541]">
          Sign in to {APP_NAME}
        </h2>
        <p className="text-sm text-[#5f625f]">Use your company account to continue.</p>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {passwordReset && !error && (
            <Alert>
              <CheckCircle2 />
              <AlertDescription>Your password has been changed. Sign in with your new password.</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="identifier" className="text-[#0a2541]">
              Email or username
            </FieldLabel>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#7b7f86]" />
              <Input
                id="identifier"
                name="identifier"
                autoComplete="username"
                placeholder="Enter your email or username"
                required
                autoFocus
                className={inputClass}
              />
            </div>
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password" className="text-[#0a2541]">
                Password
              </FieldLabel>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-orange underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#7b7f86]" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                className={cn(inputClass, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-[#7b7f86] hover:bg-[#0a2541]/5 hover:text-[#0a2541]"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#0a2541] text-base hover:bg-brand-navy-soft"
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Sign in
            {!pending && <ArrowRight className="size-5 transition-transform group-hover/button:translate-x-0.5" />}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

const inputClass =
  "h-12 rounded-xl bg-white/80 pl-10 text-[15px] placeholder:text-[#9a9c9f] focus-visible:border-[#0a2541]/40 focus-visible:ring-[#0a2541]/10";
