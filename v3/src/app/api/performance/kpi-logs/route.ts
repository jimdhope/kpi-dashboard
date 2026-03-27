import { z } from "zod";
import { NextResponse } from "next/server";
import { kpiLogService, UnauthorizedError, ForbiddenError, ValidationError, NotFoundError, InternalError } from "@/server/services/kpi-log-service";

const schema = z.object({
  kpiId: z.string().min(1, "KPI ID is required"),
  userId: z.string().optional(),
  value: z.number().min(0, "Value must be non-negative"),
  date: z.string().min(1, "Date is required"),  // When the KPI was achieved
  loggedAt: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const podId = searchParams.get("podId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const logs = await kpiLogService.list({
      podId,
      startDate,
      endDate,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("GET /api/performance/kpi-logs error:", error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof InternalError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log unexpected errors with stack trace
    console.error("Unexpected error in GET /api/performance/kpi-logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = schema.parse(body);

    const log = await kpiLogService.create({
      kpiId: payload.kpiId,
      userId: payload.userId,
      value: payload.value,
      date: new Date(payload.date),
      loggedAt: payload.loggedAt ? new Date(payload.loggedAt) : undefined,
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/kpi-logs error:", error);

    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: `Validation error: ${messages}` }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InternalError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("Unexpected error in POST /api/performance/kpi-logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Log ID is required" }, { status: 400 });
    }

    await kpiLogService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/performance/kpi-logs error:", error);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }
    if (error instanceof InternalError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("Unexpected error in DELETE /api/performance/kpi-logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
