import { NextResponse } from "next/server";
import { backupService } from "@/server/services/backup-service";
import { requireAdminUser } from "@/server/services/authorization";

export async function DELETE() {
  try {
    await requireAdminUser();

    await backupService.clearAllData();

    return NextResponse.json({
      success: true,
      message: "All data cleared successfully. Database is now empty.",
    });
  } catch (error) {
    console.error("Clear data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear data" },
      { status: 500 }
    );
  }
}