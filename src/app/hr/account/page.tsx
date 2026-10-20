import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/account-settings";
import { PageHeader } from "@/components/page-header";
import { requireHR } from "@/server/session";

export const metadata: Metadata = { title: "Account settings" };

export default async function HRAccountPage() {
  const user = await requireHR();
  return (
    <>
      <PageHeader title="Account settings" description="Your photo, name, password and the phone app." />
      <AccountSettings
        user={{ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image }}
      />
    </>
  );
}
