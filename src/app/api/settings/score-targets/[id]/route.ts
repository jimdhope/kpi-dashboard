import { NextResponse } from "next/server";
import { scoreTargetService } from "@/server/services/score-target-service";
import { requireAdminUser } from "@/server/services/authorization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser();
    const { id } = await params;
    const targets = await scoreTargetService.listTargets();
    const target = targets.find((t) => t.id === id);
    
    if (!target) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }
    
    return NextResponse.json({ target });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get target" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser();
    const { id } = await params;
    const body = await request.json();
    
    const { hashtag, name, targetType, competitionId, trackerKpiId, defaultPoints, isActive } = body;
    
    if (targetType && !["competition", "tracker"].includes(targetType)) {
      return NextResponse.json(
        { error: "targetType must be 'competition' or 'tracker'" },
        { status: 400 }
      );
    }
    
    const target = await scoreTargetService.updateTarget(id, {
      hashtag,
      name,
      targetType,
      competitionId: competitionId === null ? null : competitionId,
      trackerKpiId: trackerKpiId === null ? null : trackerKpiId,
      defaultPoints,
      isActive,
    });
    
    return NextResponse.json({ target });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update target" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser();
    const { id } = await params;
    
    await scoreTargetService.deleteTarget(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete target" },
      { status: 500 }
    );
  }
}