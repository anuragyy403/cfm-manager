import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/account-settings";
import { PageHeader } from "@/components/page-header";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Account settings" };

export default async function AdminAccountPage() {
  const user = await requireOwner();
  return (
    <>
      <PageHeader title="Account settings" description="Update your name and password." />
      <AccountSettings user={{ name: user.name, email: user.email, username: user.username }} />
    </>
  );
}
