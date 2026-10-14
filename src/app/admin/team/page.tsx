import { redirect } from "next/navigation";

/** Old address from when there was a single team; teams now live at /admin/teams. */
export default function OldTeamPage() {
  redirect("/admin/teams");
}
