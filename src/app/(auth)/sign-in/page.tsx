import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/server/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  await redirectIfSignedIn();
  const { reset } = await searchParams;
  return <SignInForm passwordReset={reset === "1"} />;
}
