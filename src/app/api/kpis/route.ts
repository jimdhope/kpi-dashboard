import { NextRequest, NextResponse } from 'next/server';
import { kpiService } from '@/server/services/kpi-service';
import { errorResponse, ok } from '@/server/http';

export async function GET() {
  try {
    const kpis = await kpiService.list();
    return ok({ kpis });
  } catch (error) {
    console.error('GET /api/kpis error:', error);
    return errorResponse(500, 'Failed to fetch KPIs');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, initials, type, maxValue, sortOrder, passFailCriteriaEnabled, passFailOperator, passFailValue } = body;

    if (!name || !initials || !type) {
      return errorResponse(400, 'Name, initials, and type are required');
    }

    const kpi = await kpiService.create({
      name,
      initials,
      type,
      maxValue,
      sortOrder,
      passFailCriteriaEnabled,
      passFailOperator,
      passFailValue,
    });

    return ok({ kpi }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return errorResponse(403, 'Forbidden');
    }
    console.error('Error creating KPI:', error);
    return errorResponse(500, 'Failed to create KPI');
  }
}
