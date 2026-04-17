import { NextResponse } from "next/server";
import { backupService, BackupData } from "@/server/services/backup-service";
import { requireAdminUser } from "@/server/services/authorization";

export async function POST(request: Request) {
  try {
    await requireAdminUser();

    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const backupData = (await request.json()) as BackupData;
      
      if (!backupData.version || !backupData.data) {
        return NextResponse.json(
          { error: "Invalid backup file format" },
          { status: 400 }
        );
      }

      const results = await backupService.importData(backupData);
      
      return NextResponse.json({
        success: true,
        message: "Backup restored successfully",
        results,
      });
    }

    return NextResponse.json(
      { error: "Unsupported content type. Expected application/json" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Backup restore error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore backup" },
      { status: 500 }
    );
  }
}