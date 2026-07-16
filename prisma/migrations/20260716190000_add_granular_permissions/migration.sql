-- Preserve each role's existing section access while introducing independently
-- configurable child permissions. Parent permissions remain the access ceiling.
INSERT INTO "RolePermission" ("id", "roleId", "resource", "level")
SELECT
  concat('granular_', substr(md5(rp."roleId" || child.resource), 1, 20)),
  rp."roleId",
  child.resource,
  rp."level"
FROM "RolePermission" rp
JOIN (VALUES
  ('nav.knowledgeBase', 'nav.knowledgeBase.articles'),
  ('nav.knowledgeBase', 'nav.knowledgeBase.categories'),
  ('nav.knowledgeBase', 'nav.knowledgeBase.tags'),
  ('nav.directory', 'nav.directory.contacts'),
  ('nav.directory', 'nav.directory.companies'),
  ('nav.directory', 'nav.directory.departments'),
  ('nav.competitions', 'nav.competitions.dashboard'),
  ('nav.competitions', 'nav.competitions.manage'),
  ('nav.competitions', 'nav.competitions.log'),
  ('nav.competitions', 'nav.competitions.certificates'),
  ('nav.performance', 'nav.performance.dashboard'),
  ('nav.performance', 'nav.performance.breakdown'),
  ('nav.performance', 'nav.performance.charts'),
  ('nav.performance', 'nav.performance.leaderboard'),
  ('nav.performance', 'nav.performance.kpis'),
  ('nav.performance', 'nav.performance.log'),
  ('nav.reports', 'nav.reports.overview'),
  ('nav.miniGames', 'nav.miniGames.play'),
  ('nav.miniGames', 'nav.miniGames.manage'),
  ('nav.usefulTools', 'nav.usefulTools.callFlow'),
  ('nav.usefulTools', 'nav.usefulTools.meterReading'),
  ('nav.usefulTools', 'nav.usefulTools.calculators'),
  ('nav.usefulTools', 'nav.usefulTools.agreedReads'),
  ('nav.activity', 'nav.activity.own'),
  ('nav.activity', 'nav.activity.all'),
  ('nav.settings', 'nav.settings.campaigns'),
  ('nav.settings', 'nav.settings.pods'),
  ('nav.settings', 'nav.settings.users'),
  ('nav.settings', 'nav.settings.permissions'),
  ('nav.settings', 'nav.settings.backup'),
  ('nav.integrations', 'nav.integrations.hashtags'),
  ('nav.integrations', 'nav.integrations.channels'),
  ('nav.integrations', 'nav.integrations.workflows'),
  ('nav.integrations', 'nav.integrations.scheduled')
) AS child(parent, resource) ON child.parent = rp."resource"
ON CONFLICT ("roleId", "resource") DO NOTHING;

-- Least-privilege organisation-management defaults. Administrators retain the
-- copied full access and can customise every value from the permission matrix.
UPDATE "RolePermission" rp SET "level" = defaults.level::"PermissionLevel"
FROM "Role" role
JOIN (VALUES
  ('campaignManager', 'nav.settings.campaigns', 'MANAGE'),
  ('campaignManager', 'nav.settings.pods', 'MANAGE'),
  ('campaignManager', 'nav.settings.users', 'VIEW'),
  ('campaignManager', 'nav.settings.permissions', 'NONE'),
  ('campaignManager', 'nav.settings.backup', 'NONE'),
  ('podManager', 'nav.settings.campaigns', 'NONE'),
  ('podManager', 'nav.settings.pods', 'VIEW'),
  ('podManager', 'nav.settings.users', 'MANAGE'),
  ('podManager', 'nav.settings.permissions', 'NONE'),
  ('podManager', 'nav.settings.backup', 'NONE'),
  ('teamLeader', 'nav.settings.campaigns', 'NONE'),
  ('teamLeader', 'nav.settings.pods', 'NONE'),
  ('teamLeader', 'nav.settings.users', 'MANAGE'),
  ('teamLeader', 'nav.settings.permissions', 'NONE'),
  ('teamLeader', 'nav.settings.backup', 'NONE'),
  ('competitionRunner', 'nav.settings.campaigns', 'NONE'),
  ('competitionRunner', 'nav.settings.pods', 'NONE'),
  ('competitionRunner', 'nav.settings.users', 'NONE'),
  ('competitionRunner', 'nav.settings.permissions', 'NONE'),
  ('competitionRunner', 'nav.settings.backup', 'NONE')
) AS defaults(role_key, resource, level) ON defaults.role_key = role."key"::text
WHERE rp."roleId" = role.id AND rp.resource = defaults.resource;
