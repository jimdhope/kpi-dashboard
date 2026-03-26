import { NextRequest, NextResponse } from 'next/server';
import { kpiService } from '@/server/services/kpi-service';
import { errorResponse, ok } from '@/server/http';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const kpi = await kpiService.getById(params.id);
    if (!kpi) {
      return errorResponse(404, 'KPI not found');
    }
    return ok({ kpi });
  } catch {
    return errorResponse(500, 'Failed to fetch KPI');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, initials, type, maxValue, sortOrder, passFailCriteriaEnabled, passFailOperator, passFailValue } = body;

    const existingKpi = await kpiService.getById(params.id);
    if (!existingKpi) {
      return errorResponse(404, 'KPI not found');
    }

    const kpi = await kpiService.update(params.id, {
      name,
      initials,
      type,
      maxValue,
      sortOrder,
      passFailCriteriaEnabled,
      passFailOperator,
      passFailValue,
    });

    return ok({ kpi });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return errorResponse(403, 'Forbidden');
    }
    console.error('Error updating KPI:', error);
    return errorResponse(500, 'Failed to update KPI');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingKpi = await kpiService.getById(params.id);
    if (!existingKpi) {
      return errorResponse(404, 'KPI not found');
    }

    await kpiService.delete(params.id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return errorResponse(403, 'Forbidden');
    }
    console.error('Error deleting KPI:', error);
    return errorResponse(500, 'Failed to delete KPI');
  }
}
