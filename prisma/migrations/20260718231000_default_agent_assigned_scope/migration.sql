-- Agents need assigned-pod visibility for leaderboards and colleague names.
-- This remains configurable after deployment through the Permissions page.
UPDATE "RolePermission" AS permission
SET "level" = 'VIEW'::"PermissionLevel"
FROM "Role" AS role
WHERE permission."roleId" = role."id"
  AND role."key" = 'agent'::"RoleKey"
  AND permission."resource" IN ('scope.organization', 'scope.people', 'scope.competitions')
  AND permission."level" = 'NONE'::"PermissionLevel";

-- These sensitive capabilities were previously guarded by literal Admin role
-- checks. They now live in the same configurable matrix, with equivalent safe
-- defaults on upgrade.
WITH resources("resource") AS (
  VALUES
    ('nav.settings.userAccounts'),
    ('nav.settings.userRoles'),
    ('nav.settings.podDeletion'),
    ('nav.settings.announcements'),
    ('nav.settings.feedback')
)
INSERT INTO "RolePermission" ("id", "roleId", "resource", "level")
SELECT 'cap-' || md5(role."id" || resources."resource"), role."id", resources."resource",
  CASE WHEN role."key" = 'admin'::"RoleKey" THEN 'MANAGE'::"PermissionLevel" ELSE 'NONE'::"PermissionLevel" END
FROM "Role" AS role
CROSS JOIN resources
ON CONFLICT ("roleId", "resource") DO NOTHING;
