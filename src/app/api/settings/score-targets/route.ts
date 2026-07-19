import { NextResponse } from "next/server";
import { scoreTargetService } from "@/server/services/score-target-service";
import { requireResourceAccess } from "@/server/services/authorization";

export async function GET() {
  try {
    await requireResourceAccess("nav.integrations.hashtags", "MANAGE");
    const targets = await scoreTargetService.listTargets();
    return NextResponse.json({ targets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list targets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireResourceAccess("nav.integrations.hashtags", "MANAGE");
    const body = await request.json();
    
    const { hashtag, name, targetType, competitionId, trackerKpiId, defaultPoints } = body;
    
    if (!hashtag || !name || !targetType) {
      return NextResponse.json(
        { error: "Missing required fields: hashtag, name, targetType" },
        { status: 400 }
      );
    }
    
    if (!["competition", "tracker"].includes(targetType)) {
      return NextResponse.json(
        { error: "targetType must be 'competition' or 'tracker'" },
        { status: 400 }
      );
    }
    
    const target = await scoreTargetService.createTarget({
      hashtag,
      name,
      targetType,
      competitionId: competitionId || null,
      trackerKpiId: trackerKpiId || null,
      defaultPoints: defaultPoints || 1,
    });
    
    return NextResponse.json({ target });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create target" },
      { status: 500 }
    );
  }
}
