import { NextRequest, NextResponse } from 'next/server';
import { teamsWebhookService } from '@/server/services/teams-webhook-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await teamsWebhookService.testConnection(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test connection' },
      { status: 500 }
    );
  }
}
