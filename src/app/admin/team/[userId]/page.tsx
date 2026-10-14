import { redirect } from "next/navigation";

/** Old member profile address; profiles now live at /admin/people/[userId]. */
export default async function OldMemberPage({ params }: PageProps<"/admin/team/[userId]">) {
  const { userId } = await params;
  redirect(`/admin/people/${encodeURIComponent(userId)}`);
}
