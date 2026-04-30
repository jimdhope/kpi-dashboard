import { z } from "zod";
import { NextResponse } from "next/server";
import { kpiLogService, UnauthorizedError, ForbiddenError, ValidationError, NotFoundError, InternalError } from "@/server/services/kpi-log-service";

const logSchema = z.object({
  kpiId: z.string().min(1, "KPI ID is required"),
  userId: z.string().optional(),
  value: z.number().min(0, "Value must be non-negative"),
  date: z.string().min(1, "Date is required").optional(),
  loggedAt: z.string().min(1, "LoggedAt is required").optional(),
});

const batchSchema = z.object({
  logs: z.array(logSchema).min(1, "At least one log is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { logs } = batchSchema.parse(body);

    const createdLogs = await kpiLogService.createBatch(
      logs.map(log => ({
        kpiId: log.kpiId,
        userId: log.userId,
        value: log.value,
        date: new Date(log.date || log.loggedAt || new Date().toISOString()),
        loggedAt: log.loggedAt ? new Date(log.loggedAt) : undefined,
      }))
    );

    return NextResponse.json({ logs: createdLogs }, { status: 201 });
  } catch (error) {
    console.error("POST /api/performance/kpi-logs/batch error:", error);

    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e) => e.message).join(", ");
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

    console.error("Unexpected error in POST /api/performance/kpi-logs/batch:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
