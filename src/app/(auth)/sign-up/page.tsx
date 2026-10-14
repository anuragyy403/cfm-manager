import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/server/session";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  await redirectIfSignedIn();
  return <SignUpForm />;
}
