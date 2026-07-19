-- Data-scope permissions are stored in the existing permission matrix. VIEW
-- means assigned pods and MANAGE means all pods for these specific resources.
WITH defaults("roleKey", "level") AS (
  VALUES
    ('admin'::"RoleKey", 'MANAGE'::"PermissionLevel"),
    ('campaignManager'::"RoleKey", 'MANAGE'::"PermissionLevel"),
    ('podManager'::"RoleKey", 'VIEW'::"PermissionLevel"),
    ('teamLeader'::"RoleKey", 'VIEW'::"PermissionLevel"),
    ('competitionRunner'::"RoleKey", 'MANAGE'::"PermissionLevel"),
    ('agent'::"RoleKey", 'NONE'::"PermissionLevel")
), resources("resource") AS (
  VALUES ('scope.organization'), ('scope.people'), ('scope.competitions')
)
INSERT INTO "RolePermission" ("id", "roleId", "resource", "level")
SELECT 'scope-' || md5(role."id" || resources."resource"), role."id", resources."resource", defaults."level"
FROM defaults
JOIN "Role" AS role ON role."key" = defaults."roleKey"
CROSS JOIN resources
ON CONFLICT ("roleId", "resource") DO NOTHING;
