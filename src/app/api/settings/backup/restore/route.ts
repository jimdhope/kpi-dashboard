import { NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { backupService } from "@/server/services/backup-service";
import { requireAdminUser } from "@/server/services/authorization";

export async function POST(request: Request) {
  try {
    await requireAdminUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    if (!fileName.endsWith(".sql") && !fileName.endsWith(".sql.gz") && !fileName.endsWith(".gz")) {
      return NextResponse.json(
        { error: "Invalid file type. Expected .sql or .sql.gz" },
        { status: 400 }
      );
    }

    const uploadPath = `/tmp/kpi-quest-upload-${Date.now()}-${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(uploadPath, buffer);

    let sqlPath: string;
    let isGzip = false;

    if (fileName.endsWith(".gz")) {
      sqlPath = uploadPath.replace(/\.gz$/, "");
      isGzip = true;
    } else {
      sqlPath = uploadPath;
    }

    try {
      let autoBackupPath: string | null = null;

      if (isGzip) {
        autoBackupPath = await backupService.createAutoBackup();
        await backupService.restoreFromGzip(uploadPath);
      } else {
        autoBackupPath = await backupService.createAutoBackup();
        await backupService.restoreFromFile(uploadPath);
      }

      return NextResponse.json({
        success: true,
        message: "Backup restored successfully",
        autoBackupPath,
      });
    } finally {
      try {
        if (existsSync(uploadPath)) await unlink(uploadPath);
        if (isGzip && existsSync(sqlPath)) await unlink(sqlPath);
      } catch { /* ignore cleanup errors */ }
    }
  } catch (error) {
    console.error("Backup restore error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore backup" },
      { status: 500 }
    );
  }
}
