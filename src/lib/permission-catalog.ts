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
  { key: "nav.reports", label: "Reports", description: "Reporting and exports", children: [
    { key: "nav.reports.overview", label: "Reports Dashboard", description: "View organisation reports" },
  ]},
  { key: "nav.usefulTools", label: "Tools", description: "Operational calculators and guides", children: [
    { key: "nav.usefulTools.callFlow", label: "Call Flow", description: "Call handling guide" },
    { key: "nav.usefulTools.meterReading", label: "Meter Reading", description: "Meter reading guide" },
    { key: "nav.usefulTools.ihdGuide", label: "IHD Guide", description: "In-Home Display guide" },
    { key: "nav.usefulTools.calculators", label: "Calculators", description: "Energy and payment tools" },
    { key: "nav.usefulTools.agreedReads", label: "Agreed Reads", description: "Agreed reads tool" },
    { key: "nav.usefulTools.powerCuts", label: "Power Cuts", description: "UK power cut map" },
  ]},
  { key: "nav.settings", label: "Settings", description: "Organisation and account configuration", children: [
    { key: "nav.settings.campaigns", label: "Campaigns", description: "Manage campaigns" },
    { key: "nav.settings.pods", label: "Pods", description: "Manage pods and memberships" },
    { key: "nav.settings.users", label: "Users", description: "Manage scoped users and passwords" },
    { key: "nav.settings.userAccounts", label: "User accounts", description: "Create, rename and delete user accounts" },
    { key: "nav.settings.userRoles", label: "User roles", description: "Assign and remove user roles" },
    { key: "nav.settings.podDeletion", label: "Delete pods", description: "Permanently delete pods" },
    { key: "nav.settings.announcements", label: "Announcements", description: "Create and manage Message of the Day" },
    { key: "nav.settings.feedback", label: "Feedback triage", description: "Review and update submitted feedback" },
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

export const DATA_SCOPE_DEFINITIONS = [
  { key: "people", label: "People data", description: "Controls which people, absences and pod memberships are available" },
  { key: "competitions", label: "Competition data", description: "Controls which pods can be scored, corrected or sent to Teams" },
] as const;

export const PERMISSION_RESOURCE_KEYS = PERMISSION_SECTIONS.flatMap((section) => [
  section.key,
  ...section.children.map((child) => child.key),
]);
