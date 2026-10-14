"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { changePasswordSchema, profileSchema } from "@/lib/validation";

type AccountUser = { name: string; email: string; username: string | null };

export function AccountSettings({ user }: { user: AccountUser }) {
  return (
    <div className="grid max-w-2xl gap-6">
      <ProfileCard user={user} />
      <PasswordCard />
    </div>
  );
}

function CardIcon({ icon: Icon }: { icon: typeof UserRound }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange-soft text-sun-deep">
      <Icon className="size-[18px]" />
    </span>
  );
}

function ProfileCard({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your full name.");
      return;
    }
    setError(null);
    if (parsed.data.name === user.name) return;

    setPending(true);
    const { error } = await authClient.updateUser({ name: parsed.data.name });
    setPending(false);
    if (error) {
      toast.error("Could not save your name. Please try again.");
      return;
    }
    toast.success("Name updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <CardIcon icon={UserRound} />
        <div className="grid gap-1">
          <CardTitle>Profile</CardTitle>
          <CardDescription>The name your manager and team see.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <Input id="name" name="name" autoComplete="name" defaultValue={user.name} aria-invalid={!!error} />
              <FieldError>{error}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={user.email} readOnly disabled />
              {user.username && <FieldDescription>Username: @{user.username}</FieldDescription>}
            </Field>
            <div>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Save name
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

type PasswordErrors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

function PasswordCard() {
  const [fieldErrors, setFieldErrors] = useState<PasswordErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: data.get("currentPassword"),
      newPassword: data.get("newPassword"),
      confirmPassword: data.get("confirmPassword"),
    });
    if (!parsed.success) {
      const errs: PasswordErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof PasswordErrors;
        errs[key] ??= issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      revokeOtherSessions: data.get("revokeOtherSessions") === "on",
    });
    setPending(false);

    if (error) {
      if (error.code === "INVALID_PASSWORD") {
        setFieldErrors({ currentPassword: "Your current password is incorrect." });
      } else if (error.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(error.message || "Could not change your password. Please try again.");
      }
      return;
    }
    form.reset();
    toast.success("Password changed");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <CardIcon icon={KeyRound} />
        <div className="grid gap-1">
          <CardTitle>Change password</CardTitle>
          <CardDescription>You&apos;ll need your current password to set a new one.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!fieldErrors.currentPassword}>
              <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.currentPassword}
              />
              <FieldError>{fieldErrors.currentPassword}</FieldError>
            </Field>
            <Field data-invalid={!!fieldErrors.newPassword}>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                autoComplete="new-password"
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
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.confirmPassword}
              />
              <FieldError>{fieldErrors.confirmPassword}</FieldError>
            </Field>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                name="revokeOtherSessions"
                defaultChecked
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="grid gap-0.5">
                <span className="font-medium">Sign out of all other devices</span>
                <span className="text-muted-foreground">
                  Recommended. You stay signed in here; any other phone or computer will need the new password.
                </span>
              </span>
            </label>
            <div>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Change password
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
