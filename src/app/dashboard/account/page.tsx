import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/account-settings";
import { PageHeader } from "@/components/page-header";
import { requireEmployee } from "@/server/session";

export const metadata: Metadata = { title: "Account settings" };

export default async function EmployeeAccountPage() {
  const user = await requireEmployee();
  return (
    <>
      <PageHeader title="Account settings" description="Your name, password and the phone app." />
      <AccountSettings user={{ name: user.name, email: user.email, username: user.username }} />
    </>
  );
}
