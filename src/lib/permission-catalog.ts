export interface PermissionChild {
  key: string;
  label: string;
  description: string;
}

export interface PermissionSection {
  key: string;
  label: string;
  description: string;
  children: PermissionChild[];
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  { key: "nav.knowledgeBase", label: "Knowledge Base", description: "Articles and supporting content", children: [
    { key: "nav.knowledgeBase.articles", label: "Articles", description: "Browse, create and edit articles" },
    { key: "nav.knowledgeBase.categories", label: "Categories", description: "Manage article categories" },
    { key: "nav.knowledgeBase.tags", label: "Tags", description: "Manage article tags" },
  ]},
  { key: "nav.directory", label: "Directory", description: "Organisation directory records", children: [
    { key: "nav.directory.contacts", label: "Contacts", description: "View and manage contacts" },
    { key: "nav.directory.companies", label: "Companies", description: "View and manage companies" },
    { key: "nav.directory.departments", label: "Departments", description: "View and manage departments" },
  ]},
  { key: "nav.competitions", label: "Competitions", description: "Competition operation and scoring", children: [
    { key: "nav.competitions.dashboard", label: "Dashboard", description: "Competition standings and overview" },
    { key: "nav.competitions.manage", label: "Manage", description: "Create and edit competitions" },
    { key: "nav.competitions.log", label: "Log Scores", description: "Record daily competition scores" },
    { key: "nav.competitions.certificates", label: "Certificates", description: "Generate competition certificates" },
  ]},
  { key: "nav.performance", label: "Performance", description: "KPI performance data and configuration", children: [
    { key: "nav.performance.dashboard", label: "Dashboard", description: "Performance overview" },
    { key: "nav.performance.breakdown", label: "KPI Breakdown", description: "Detailed KPI results" },
    { key: "nav.performance.charts", label: "Charts", description: "Performance trend charts" },
    { key: "nav.performance.leaderboard", label: "Leaderboard", description: "Performance rankings" },
    { key: "nav.performance.kpis", label: "KPI Setup", description: "Create and configure KPIs" },
    { key: "nav.performance.log", label: "Log Performance", description: "Record performance data" },
  ]},
  { key: "nav.reports", label: "Reports", description: "Reporting and exports", children: [
    { key: "nav.reports.overview", label: "Reports Dashboard", description: "View organisation reports" },
  ]},
  { key: "nav.miniGames", label: "Mini Games", description: "Games and gamification", children: [
    { key: "nav.miniGames.play", label: "Play Games", description: "Access available mini games" },
    { key: "nav.miniGames.manage", label: "Gamification Management", description: "Manage badges and gamification" },
  ]},
  { key: "nav.usefulTools", label: "Tools", description: "Operational calculators and guides", children: [
    { key: "nav.usefulTools.callFlow", label: "Call Flow", description: "Call handling guide" },
    { key: "nav.usefulTools.meterReading", label: "Meter Reading", description: "Meter reading guide" },
    { key: "nav.usefulTools.calculators", label: "Calculators", description: "Energy and payment tools" },
    { key: "nav.usefulTools.agreedReads", label: "Agreed Reads", description: "Agreed reads tool" },
  ]},
  { key: "nav.activity", label: "Activity", description: "User and organisation activity", children: [
    { key: "nav.activity.own", label: "Own Activity", description: "View the signed-in user's activity" },
    { key: "nav.activity.all", label: "All Activity", description: "View activity across permitted users" },
  ]},
  { key: "nav.settings", label: "Settings", description: "Organisation and account configuration", children: [
    { key: "nav.settings.campaigns", label: "Campaigns", description: "Manage campaigns" },
    { key: "nav.settings.pods", label: "Pods", description: "Manage pods and memberships" },
    { key: "nav.settings.users", label: "Users", description: "Manage scoped users and passwords" },
    { key: "nav.settings.permissions", label: "Permissions", description: "Configure role permissions" },
    { key: "nav.settings.backup", label: "Backup & Restore", description: "Back up and restore application data" },
  ]},
  { key: "nav.integrations", label: "Integrations", description: "Microsoft Teams configuration", children: [
    { key: "nav.integrations.hashtags", label: "Hashtags", description: "Hashtag score targets" },
    { key: "nav.integrations.channels", label: "Channels", description: "Teams webhook channels" },
    { key: "nav.integrations.workflows", label: "Workflows", description: "Event-driven workflows" },
    { key: "nav.integrations.scheduled", label: "Scheduled", description: "Scheduled Teams messages" },
  ]},
];

export const PERMISSION_RESOURCE_KEYS = PERMISSION_SECTIONS.flatMap((section) => [
  section.key,
  ...section.children.map((child) => child.key),
]);
