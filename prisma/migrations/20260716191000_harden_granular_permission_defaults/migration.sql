UPDATE "RolePermission" rp
SET "level" = 'NONE'::"PermissionLevel"
FROM "Role" role
WHERE rp."roleId" = role.id
  AND role."key" = 'agent'::"RoleKey"
  AND rp.resource = 'nav.activity.all';

UPDATE "RolePermission" rp
SET "level" = 'VIEW'::"PermissionLevel"
FROM "Role" role
WHERE rp."roleId" = role.id
  AND role."key" = 'campaignManager'::"RoleKey"
  AND rp.resource = 'nav.settings.users';
