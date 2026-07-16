import { redirect } from "next/navigation";

export default function LegacyTeamsWebhooksPage() {
  redirect("/settings/teams/channels");
}
