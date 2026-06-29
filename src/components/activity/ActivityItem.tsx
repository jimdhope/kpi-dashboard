'use client';

import React, { useState } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { 
  Trophy, Target, BarChart3, Gamepad2, Award, TrendingUp, 
  Swords, User, Medal, ChevronDown, ChevronUp, Star, Clock,
  Flag, CheckCircle, CalendarX, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityRecord, ActivityType } from '@/lib/contracts';
import { ACTIVITY_TYPE_CONFIG } from '@/lib/contracts';
import { Card, CardContent } from '@/components/ui/card';
import { AgentAvatar } from './AgentAvatar';

// Icon mapping using lucide-react icons
const iconMap: Record<string, React.ElementType> = {
  Trophy,
  Target,
  BarChart3,
  Gamepad2,
  Award,
  TrendingUp,
  Swords,
  User,
  Medal,
  Star,
  Flag,
  CheckCircle,
  CalendarX,
  Crown,
};

// Get icon component for activity type
function getActivityIcon(type: string) {
  const config = ACTIVITY_TYPE_CONFIG[type as ActivityType];
  const iconName = config?.icon || 'Star';
  return iconMap[iconName] || Star;
}

// Format timestamp for display
function formatTimestamp(timestamp: Date): string {
  if (isToday(timestamp)) {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  }
  
  if (isYesterday(timestamp)) {
    return `Yesterday at ${format(timestamp, 'h:mm a')}`;
  }
  
  return format(timestamp, 'MMM d, yyyy');
}

// Format full timestamp for tooltips
function formatFullTimestamp(timestamp: Date): string {
  return format(timestamp, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
}

// Activity-specific detail renderer
// Type for activity metadata
interface ActivityMetadata {
  competitionId?: string;
  competitionName?: string;
  teamName?: string;
  finalScore?: number;
  rank?: number;
  points?: number;
  ruleName?: string;
  value?: number;
  kpiId?: string;
  kpiName?: string;
  previousValue?: number;
  newValue?: number;
  targetValue?: number;
  gameId?: string;
  gameName?: string;
  result?: 'win' | 'loss' | 'draw';
  score?: number;
  trackerId?: string;
  trackerName?: string;
  milestone?: string;
  recorderId?: string;
  recorderName?: string;
  fieldsUpdated?: string[];
  achievementName?: string;
  badgeName?: string;
  [key: string]: unknown;
}

function ActivityDetails({ activity }: { activity: ActivityRecord }) {
  const { type, metadataJson } = activity;
  const metadata: ActivityMetadata = (metadataJson || {}) as ActivityMetadata;
  
  switch (type) {
    case 'competition_joined':
    case 'competition_completed':
    case 'competition_started':
      return (
        <div className="space-y-2">
          {metadata.competitionName && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{metadata.competitionName as string}</span>
            </div>
          )}
          {metadata.teamName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Team: {metadata.teamName as string}</span>
            </div>
          )}
          {metadata.finalScore !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>Final Score: <span className="font-bold">{(metadata.finalScore as number).toLocaleString()}</span></span>
            </div>
          )}
          {metadata.rank !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Medal className="h-4 w-4 text-yellow-500" />
              <span>Rank: <span className="font-bold">#{(metadata.rank as number)}</span></span>
            </div>
          )}
        </div>
      );
      
    case 'score_logged':
    case 'achievement_earned':
    case 'milestone_reached':
    case 'badge_earned':
      return (
        <div className="space-y-2">
          {metadata.ruleName && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-purple-500" />
              <span className="font-medium">{metadata.ruleName as string}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-primary" />
            <span>+{metadata.points} points</span>
            {metadata.value !== undefined && (metadata.value as number) > 0 && (
              <span className="text-muted-foreground">(x{metadata.value as number})</span>
            )}
          </div>
        </div>
      );
      
    case 'kpi_updated':
    case 'kpi_goal_reached':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4 text-cyan-500" />
            <span className="font-medium">{metadata.kpiName as string}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {metadata.previousValue !== undefined && (
              <>
                <span className="text-muted-foreground line-through">{metadata.previousValue as number}</span>
                <span>→</span>
              </>
            )}
            <span className="font-bold text-primary">{metadata.newValue as number}</span>
            {metadata.targetValue !== undefined && (
              <span className="text-muted-foreground">/ {metadata.targetValue as number}</span>
            )}
          </div>
          {type === 'kpi_goal_reached' && (
            <div className="flex items-center gap-1 text-sm text-green-500">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Goal Reached!</span>
            </div>
          )}
        </div>
      );
      
    case 'game_played':
    case 'game_won':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Gamepad2 className="h-4 w-4 text-orange-500" />
            <span className="font-medium">{metadata.gameName as string}</span>
          </div>
          {metadata.result && (
            <div className="flex items-center gap-2 text-sm">
              {metadata.result === 'win' && <Swords className="h-4 w-4 text-green-500" />}
              {metadata.result === 'loss' && <Swords className="h-4 w-4 text-red-500" />}
              {metadata.result === 'draw' && <Gamepad2 className="h-4 w-4 text-yellow-500" />}
              <span className="capitalize">{metadata.result as string}</span>
            </div>
          )}
          {metadata.score !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>Score: {metadata.score as number}</span>
            </div>
          )}
        </div>
      );
      
    case 'profile_updated':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <span>Updated: {(metadata.fieldsUpdated as string[])?.join(', ') || 'profile'}</span>
          </div>
        </div>
      );

    // Tracker activity types
    case 'tracker_created':
    case 'tracker_entry_logged':
    case 'tracker_milestone':
      return (
        <div className="space-y-2">
          {metadata.trackerName && (
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-teal-500" />
              <span className="font-medium">{metadata.trackerName as string}</span>
            </div>
          )}
          {metadata.value !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>Value: <span className="font-bold">{metadata.value as number}</span></span>
            </div>
          )}
          {metadata.milestone && (
            <div className="flex items-center gap-1 text-sm text-green-500">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Milestone: {metadata.milestone as string}</span>
            </div>
          )}
          {metadata.recorderName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Recorded by: {metadata.recorderName as string}</span>
            </div>
          )}
        </div>
      );
      
    default:
      return activity.description ? (
        <p className="text-sm text-muted-foreground">{activity.description}</p>
      ) : null;
  }
}

interface ActivityItemProps {
  activity: ActivityRecord;
  isFirst?: boolean;
  isLast?: boolean;
  className?: string;
}

export function ActivityItem({ activity, isFirst, isLast, className }: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const Icon = getActivityIcon(activity.type);
  const config = ACTIVITY_TYPE_CONFIG[activity.type as ActivityType];
  
  // Check if this activity has details to expand
  const hasDetails = activity.metadataJson && Object.keys(activity.metadataJson).length > 0;
  
  // Determine display title: richMessage takes priority
  const displayTitle = activity.richMessage || activity.title;
  
  // Determine agent name for display (fallback to Unknown Agent)
  const agentName = activity.agentName || 'Unknown Agent';
  
  // Check if recorder is different from agent
  const showRecorder = activity.recorderName && activity.recorderName !== activity.agentName;
  
  const timestamp = new Date(activity.createdAt);

  return (
    <div className={cn('relative', className)}>
      {/* Timeline connector */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border">
        {!isFirst && (
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-transparent to-border" />
        )}
        {!isLast && (
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-transparent to-border" />
        )}
      </div>
      
      {/* Timeline node */}
      <div className={cn(
        'relative z-10 flex items-start gap-4',
        !isFirst && 'pt-6'
      )}>
        {/* Agent Avatar - shown next to activity */}
        <div className="flex-shrink-0">
          <AgentAvatar 
            agentName={agentName} 
            size="sm" 
          />
        </div>
        
        {/* Icon circle */}
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 border-background',
          config?.bgColor || 'bg-gray-500/20',
          config?.color || 'text-gray-500'
        )}>
          <Icon className={cn('h-5 w-5', config?.color || 'text-gray-500')} />
        </div>
        
        {/* Content card */}
        <Card 
          variant="glass" 
          className={cn(
            'flex-1 min-w-0 transition-all duration-200',
            hasDetails && 'cursor-pointer hover:bg-glass/80',
            isExpanded && 'ring-1 ring-primary/30'
          )}
          onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {/* Title and timestamp */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-medium text-sm sm:text-base truncate">
                    {displayTitle}
                  </h3>
                  {activity.type === 'competition_completed' && (activity.metadataJson as { rank?: number })?.rank && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      ((activity.metadataJson as { rank?: number }).rank ?? 0) === 1 
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : ((activity.metadataJson as { rank?: number }).rank ?? 0) <= 3
                          ? 'bg-gray-500/20 text-gray-400'
                          : 'bg-glass text-muted-foreground'
                    )}>
                      #{(activity.metadataJson as { rank?: number }).rank}
                    </span>
                  )}
                </div>
                
                {/* "Recorded by" attribution chip - shown when different from agent */}
                {showRecorder && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">
                      recorded by 
                    </span>
                    <span className="text-xs font-medium text-muted-foreground/80">
                      {activity.recorderName}
                    </span>
                  </div>
                )}
                
                {/* Timestamp */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span title={formatFullTimestamp(timestamp)}>
                    {formatTimestamp(timestamp)}
                  </span>
                </div>
                
                {/* Quick description (always visible) */}
                {activity.description && !isExpanded && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {activity.description}
                  </p>
                )}
              </div>
              
              {/* Expand indicator */}
              {hasDetails && (
                <button 
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-glass/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
            
            {/* Expanded details */}
            {isExpanded && hasDetails && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <ActivityDetails activity={activity} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ActivityItemSkeletonProps {
  isFirst?: boolean;
  isLast?: boolean;
}

export function ActivityItemSkeleton({ isFirst, isLast }: ActivityItemSkeletonProps) {
  return (
    <div className="relative">
      {/* Timeline connector */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border/50" />
      
      {/* Timeline node */}
      <div className={cn(
        'relative z-10 flex items-start gap-4',
        !isFirst && 'pt-6'
      )}>
        {/* Icon circle skeleton */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-glass animate-pulse" />
        
        {/* Content card skeleton */}
        <Card variant="glass" className="flex-1 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="h-5 w-48 bg-glass animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-glass animate-pulse rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
