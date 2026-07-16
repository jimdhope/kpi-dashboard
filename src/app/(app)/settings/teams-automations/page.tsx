import { redirect } from "next/navigation";

export default function LegacyTeamsAutomationsPage() {
  redirect("/settings/teams/workflows");
}
