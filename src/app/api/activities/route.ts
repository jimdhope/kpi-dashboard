import { NextRequest, NextResponse } from 'next/server';
import { activityRepository } from '@/server/repositories/activity-repository';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';
import { prisma } from '@/server/db/client';

// GET /api/activities - List activities with filters
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let user;
    try {
      user = await authService.requireCurrentUser();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;

    // Build where clause
    const where: Record<string, unknown> = {};

    // User filter: if not admin, only show own activities
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    if (userId) {
      // Admin can view any user's activities
      if (!isAdmin && userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.userId = userId;
    } else if (!isAdmin) {
      where.userId = user.id;
    }

    // Type filter
    if (type) {
      where.type = type;
    }

    // Category filter - map category to activity types
    if (category && category !== 'all') {
      const categoryTypes = getActivityTypesByCategory(category);
      where.type = { in: categoryTypes };
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    // Fetch activities with pagination
    const [activities, total] = await Promise.all([
      activityRepository.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      activityRepository.count(where),
    ]);

    // Transform to ActivityRecord format
    const transformedActivities = activities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      userName: activity.user?.name || activity.agentName,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      metadataJson: activity.metadataJson,
      createdAt: activity.createdAt.toISOString(),
      agentName: activity.agentName,
      recorderId: activity.recorderId,
      recorderName: activity.recorderName,
      richMessage: activity.richMessage,
    }));

    return NextResponse.json({
      activities: transformedActivities,
      total,
      hasMore: offset + activities.length < total,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/activities - Create new activity (internal use)
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let user;
    try {
      user = await authService.requireCurrentUser();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      title,
      description,
      metadata,
      userId,
      userName,
      recorderId,
      recorderName,
      richMessage,
    } = body;

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json(
        { error: 'type and title are required' },
        { status: 400 }
      );
    }

    // Create activity
    const activity = await activityRepository.create({
      type,
      title,
      description: description || null,
      metadata: metadata || null,
      userId: userId || user.id,
      agentName: userName || user.name,
      recorderId: recorderId || null,
      recorderName: recorderName || null,
      richMessage: richMessage || null,
    });

    // Transform response - activity returned from create doesn't include user relation
    const createdAtValue = typeof activity.createdAt === 'string' 
      ? activity.createdAt 
      : (activity.createdAt as Date).toISOString();
      
    const transformedActivity = {
      id: activity.id,
      userId: activity.userId,
      userName: activity.agentName,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      metadataJson: activity.metadataJson,
      createdAt: createdAtValue,
      agentName: activity.agentName,
      recorderId: activity.recorderId,
      recorderName: activity.recorderName,
      richMessage: activity.richMessage,
    };

    return NextResponse.json(transformedActivity, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get activity types by category
function getActivityTypesByCategory(category: string): string[] {
  const categoryMap: Record<string, string[]> = {
    trackers: [
      'tracker_created',
      'tracker_entry_logged',
      'tracker_milestone',
    ],
    competitions: [
      'competition_joined',
      'competition_completed',
      'competition_started',
      'competition_won',
      'competition_score_logged',
      'competition_milestone',
      'competition_absent',
    ],
    scores: [
      'score_logged',
      'achievement_earned',
      'milestone_reached',
      'badge_earned',
    ],
    kpis: [
      'kpi_created',
      'kpi_updated',
      'kpi_goal_reached',
      'kpi_goal_achieved',
      'kpi_trend_improved',
    ],
    games: [
      'game_played',
      'game_won',
      'game_high_score',
      'game_achievement',
    ],
    profile: ['profile_updated'],
  };

  return categoryMap[category] || [];
}
