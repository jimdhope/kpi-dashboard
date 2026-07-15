import { NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { basename } from "path";
import { randomUUID } from "crypto";
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

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "Backup exceeds the 100 MB upload limit" }, { status: 413 });
    }

    const fileName = basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!fileName.endsWith(".sql") && !fileName.endsWith(".sql.gz") && !fileName.endsWith(".gz")) {
      return NextResponse.json(
        { error: "Invalid file type. Expected .sql or .sql.gz" },
        { status: 400 }
      );
    }

    const uploadPath = `/tmp/kpi-quest-upload-${randomUUID()}-${fileName}`;
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
        if (existsSync(/* turbopackIgnore: true */ uploadPath)) await unlink(uploadPath);
        if (isGzip && existsSync(/* turbopackIgnore: true */ sqlPath)) await unlink(sqlPath);
      } catch { /* ignore cleanup errors */ }
    }
  } catch (error) {
    console.error("Backup restore error:", error);
    return NextResponse.json(
      { error: "Failed to restore backup. Check the server logs for details." },
      { status: 500 }
    );
  }
}
