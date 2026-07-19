import { NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import { backupService } from "@/server/services/backup-service";
import { requireResourceAccess } from "@/server/services/authorization";

export async function GET() {
  try {
    await requireResourceAccess("nav.settings.backup", "MANAGE");

    const timestamp = new Date().toISOString().split("T")[0];
    const outputPath = `/tmp/kpi-quest-backup-${Date.now()}.sql.gz`;

    await backupService.exportToGzip(outputPath);

    const buffer = await readFile(/* turbopackIgnore: true */ outputPath);
    await unlink(outputPath).catch(() => {});

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="kpi-quest-backup-${timestamp}.sql.gz"`,
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json(
      { error: "Failed to export backup. Check the server logs for details." },
      { status: 500 }
    );
  }
}
