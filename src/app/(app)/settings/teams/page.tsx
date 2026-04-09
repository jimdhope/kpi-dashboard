import { redirect } from "next/navigation";

export default function TeamsIndexPage() {
  // Redirect to channels by default
  redirect("/settings/teams/channels");
}
