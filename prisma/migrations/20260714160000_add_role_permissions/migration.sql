-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionLevel') THEN
    CREATE TYPE "PermissionLevel" AS ENUM ('NONE', 'VIEW', 'MANAGE');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "level" "PermissionLevel" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_resource_key" ON "RolePermission"("roleId", "resource");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RolePermission_roleId_fkey'
  ) THEN
    ALTER TABLE "RolePermission"
      ADD CONSTRAINT "RolePermission_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
