import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isResetTokenValid } from "@/server/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

// The token is in the URL: never send it to other sites in the Referer header.
export const metadata: Metadata = { title: "Set a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : undefined;

  if (!(await isResetTokenValid(value))) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <LinkIcon className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">This link has expired</h2>
          <p className="text-sm text-muted-foreground">
            Password reset links work once and expire after 1 hour. Request a new one and use it straight away.
          </p>
        </div>
        <div className="grid gap-2">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={value!} />;
}
