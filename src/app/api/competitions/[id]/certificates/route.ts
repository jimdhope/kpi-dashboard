import { errorResponse, ok } from "@/server/http";
import { certificateService } from "@/server/services/certificate-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const podId = url.searchParams.get('podId') || undefined;

    if (podId) {
      const data = await certificateService.getCertificatesByPod(id, podId);
      return ok({ certificates: data });
    } else {
      const data = await certificateService.getCertificateData(id);
      return ok({ certificates: data });
    }
  } catch (error) {
    console.error('GET /api/competitions/[id]/certificates error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(404, error.message);
    }
    return errorResponse(500, "Failed to get certificate data.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { userName, rank, score, podName, dateRange } = body;

    if (!userName || rank === undefined || score === undefined) {
      return errorResponse(400, "userName, rank, and score are required");
    }

    const html = await certificateService.generateCertificateHtml({
      rank,
      userName,
      competitionName: '', // Will be filled from competition
      score,
      podName,
      dateRange,
    });

    return ok({ html });
  } catch (error) {
    console.error('POST /api/competitions/[id]/certificates error:', error);
    return errorResponse(500, "Failed to generate certificate.");
  }
}
