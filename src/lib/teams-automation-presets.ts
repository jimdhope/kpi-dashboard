import { TeamsAutomationDeliveryFormat, TeamsAutomationFactTemplate } from "@/lib/contracts";

export interface TeamsAutomationPreset {
  id: string;
  name: string;
  description: string;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  titleTemplate: string;
  messageTemplate: string;
  facts: TeamsAutomationFactTemplate[];
  adaptiveCardJson: string;
  imageTitleTemplate: string;
  imageSubtitleTemplate: string;
  imageMetricTemplate: string;
  imageFooterTemplate: string;
  imageAccentColor: string;
}

export const TEAMS_AUTOMATION_PRESETS: TeamsAutomationPreset[] = [
  {
    id: "achievement-card",
    name: "Achievement Card",
    description: "Celebration-style adaptive card for achievements and wins.",
    deliveryFormat: "adaptiveCardWithImage",
    titleTemplate: "{{userName}} unlocked an achievement",
    messageTemplate: "{{userName}} just pushed {{trackerName}} forward in {{campaignName}}.",
    facts: [
      { name: "User", valueTemplate: "{{userName}}" },
      { name: "Tracker", valueTemplate: "{{trackerName}}" },
      { name: "Campaign", valueTemplate: "{{campaignName}}" },
    ],
    adaptiveCardJson: `{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": "{{userName}} unlocked an achievement", "wrap": true },
    { "type": "TextBlock", "text": "{{userName}} just pushed {{trackerName}} forward in {{campaignName}}.", "wrap": true, "spacing": "Medium" },
    { "type": "Image", "url": "{{imageUrl}}", "size": "Stretch", "spacing": "Medium" },
    { "type": "FactSet", "facts": [
      { "title": "User", "value": "{{userName}}" },
      { "title": "Metric", "value": "{{trackerValue}}" },
      { "title": "Campaign", "value": "{{campaignName}}" }
    ] }
  ]
}`,
    imageTitleTemplate: "{{userName}}",
    imageSubtitleTemplate: "Achievement unlocked in {{campaignName}}",
    imageMetricTemplate: "{{trackerName}}: {{trackerValue}}",
    imageFooterTemplate: "Keep the momentum going",
    imageAccentColor: "007A5A",
  },
  {
    id: "performance-summary",
    name: "Performance Summary",
    description: "Compact adaptive card for KPI and performance updates.",
    deliveryFormat: "adaptiveCard",
    titleTemplate: "Performance update for {{campaignName}}",
    messageTemplate: "{{userName}} logged {{trackerValue}} against {{trackerName}}.",
    facts: [
      { name: "User", valueTemplate: "{{userName}}" },
      { name: "Value", valueTemplate: "{{trackerValue}}" },
      { name: "Tracker", valueTemplate: "{{trackerName}}" },
    ],
    adaptiveCardJson: `{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": "Performance update for {{campaignName}}", "wrap": true },
    { "type": "TextBlock", "text": "{{userName}} logged {{trackerValue}} against {{trackerName}}.", "wrap": true, "spacing": "Medium" },
    { "type": "FactSet", "facts": [
      { "title": "User", "value": "{{userName}}" },
      { "title": "Value", "value": "{{trackerValue}}" },
      { "title": "Tracker", "value": "{{trackerName}}" }
    ] }
  ]
}`,
    imageTitleTemplate: "",
    imageSubtitleTemplate: "",
    imageMetricTemplate: "",
    imageFooterTemplate: "",
    imageAccentColor: "0B6E4F",
  },
  {
    id: "competition-podium",
    name: "Competition Podium",
    description: "Image-led competition or leaderboard announcement.",
    deliveryFormat: "adaptiveCardWithImage",
    titleTemplate: "{{competitionName}} update",
    messageTemplate: "{{userName}} is now on {{totalScore}} points after a {{scoreDelta}} point update.",
    facts: [
      { name: "Competition", valueTemplate: "{{competitionName}}" },
      { name: "User", valueTemplate: "{{userName}}" },
      { name: "Total", valueTemplate: "{{totalScore}}" },
    ],
    adaptiveCardJson: `{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": "{{competitionName}} update", "wrap": true },
    { "type": "Image", "url": "{{imageUrl}}", "size": "Stretch", "spacing": "Medium" },
    { "type": "TextBlock", "text": "{{userName}} is now on {{totalScore}} points after a {{scoreDelta}} point update.", "wrap": true, "spacing": "Medium" }
  ]
}`,
    imageTitleTemplate: "{{competitionName}}",
    imageSubtitleTemplate: "{{userName}} is climbing the board",
    imageMetricTemplate: "{{totalScore}} pts",
    imageFooterTemplate: "Latest change: {{scoreDelta}}",
    imageAccentColor: "B26E12",
  },
];

export const TEAMS_AUTOMATION_PREVIEW_CONTEXT: Record<string, string> = {
  endpointName: "North Ops Channel",
  campaignName: "Spring Growth Push",
  podName: "Pod Mercury",
  payloadText: "15 fresh appointments landed in the last 15 minutes.",
  payloadSummary: "New activity summary",
  payloadTitle: "Channel activity",
  userName: "Jordan Lee",
  trackerName: "Appointments Set",
  trackerValue: "15",
  competitionName: "Q2 Sprint Cup",
  scoreDelta: "5",
  totalScore: "27",
  imageUrl: "/api/render/teams-image?title=Preview&subtitle=Adaptive%20Card&metric=15&footer=KPI%20Quest&accent=007A5A",
};
