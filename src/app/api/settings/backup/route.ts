import { NextResponse } from "next/server";
import { backupService } from "@/server/services/backup-service";
import { requireAdminUser } from "@/server/services/authorization";

export async function GET() {
  try {
    await requireAdminUser();

    const backupData = await backupService.exportAllData();

    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="kpi-quest-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export backup" },
      { status: 500 }
    );
  }
}