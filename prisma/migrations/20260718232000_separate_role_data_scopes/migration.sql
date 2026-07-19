CREATE TYPE "DataScopeLevel" AS ENUM ('NONE', 'ASSIGNED_PODS', 'ALL_PODS');

CREATE TABLE "RoleDataScope" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "level" "DataScopeLevel" NOT NULL DEFAULT 'NONE',
  CONSTRAINT "RoleDataScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleDataScope_roleId_resource_key" ON "RoleDataScope"("roleId", "resource");
ALTER TABLE "RoleDataScope" ADD CONSTRAINT "RoleDataScope_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RoleDataScope" ("id", "roleId", "resource", "level")
SELECT
  'data-scope-' || md5(permission."roleId" || permission."resource"),
  permission."roleId",
  CASE permission."resource" WHEN 'scope.people' THEN 'people' ELSE 'competitions' END,
  CASE permission."level"
    WHEN 'MANAGE'::"PermissionLevel" THEN 'ALL_PODS'::"DataScopeLevel"
    WHEN 'VIEW'::"PermissionLevel" THEN 'ASSIGNED_PODS'::"DataScopeLevel"
    ELSE 'NONE'::"DataScopeLevel"
  END
FROM "RolePermission" AS permission
WHERE permission."resource" IN ('scope.people', 'scope.competitions')
ON CONFLICT ("roleId", "resource") DO NOTHING;

DELETE FROM "RolePermission" WHERE "resource" IN ('scope.organization', 'scope.people', 'scope.competitions');
