INSERT INTO "RolePermission" ("id", "roleId", "resource", "level")
SELECT md5(random()::text || clock_timestamp()::text), "id", 'nav.miniGames.quizManage', 'MANAGE'::"PermissionLevel"
FROM "Role"
WHERE "key" IN ('admin', 'podManager', 'teamLeader')
ON CONFLICT ("roleId", "resource") DO NOTHING;
