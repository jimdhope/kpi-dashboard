'use client';

import React, { useState } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { 
  Trophy, Target, BarChart3, Gamepad2, Award, TrendingUp, 
  Swords, User, Medal, ChevronDown, ChevronUp, Star, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentActivity, ActivityType } from '@/types/activity';
import { ActivityTypeConfig } from '@/types/activity';
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
};

// Get icon component for activity type
function getActivityIcon(type: ActivityType) {
  const config = ActivityTypeConfig[type];
  const iconName = config?.icon || 'Star';
  const Icon = iconMap[iconName] || Star;
  return Icon;
}

// Format timestamp for display
function formatTimestamp(timestamp: Date): string {
  const date = new Date(timestamp);
  
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  
  return format(date, 'MMM d, yyyy');
}

// Format full timestamp for tooltips
function formatFullTimestamp(timestamp: Date): string {
  return format(new Date(timestamp), 'EEEE, MMMM d, yyyy \'at\' h:mm a');
}

// Activity-specific detail renderer
function ActivityDetails({ activity }: { activity: AgentActivity }) {
  const { type, metadata } = activity;
  
  switch (type) {
    case 'competition_joined':
    case 'competition_completed':
    case 'competition_started':
      return (
        <div className="space-y-2">
          {metadata.competitionName && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{metadata.competitionName}</span>
            </div>
          )}
          {metadata.teamName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Team: {metadata.teamName}</span>
            </div>
          )}
          {metadata.finalScore !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>Final Score: <span className="font-bold">{metadata.finalScore.toLocaleString()}</span></span>
            </div>
          )}
          {metadata.rank !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Medal className="h-4 w-4 text-yellow-500" />
              <span>Rank: <span className="font-bold">#{metadata.rank}</span></span>
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
              <span className="font-medium">{metadata.ruleName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-primary" />
            <span>+{metadata.points} points</span>
            {metadata.value !== undefined && metadata.value > 0 && (
              <span className="text-muted-foreground">(x{metadata.value})</span>
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
            <span className="font-medium">{metadata.kpiName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {metadata.previousValue !== undefined && (
              <>
                <span className="text-muted-foreground line-through">{metadata.previousValue}</span>
                <span>→</span>
              </>
            )}
            <span className="font-bold text-primary">{metadata.newValue}</span>
            {metadata.targetValue !== undefined && (
              <span className="text-muted-foreground">/ {metadata.targetValue}</span>
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
            <span className="font-medium">{metadata.gameName}</span>
          </div>
          {metadata.result && (
            <div className="flex items-center gap-2 text-sm">
              {metadata.result === 'win' && <Swords className="h-4 w-4 text-green-500" />}
              {metadata.result === 'loss' && <Swords className="h-4 w-4 text-red-500" />}
              {metadata.result === 'draw' && <Gamepad2 className="h-4 w-4 text-yellow-500" />}
              <span className="capitalize">{metadata.result}</span>
            </div>
          )}
          {metadata.score !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>Score: {metadata.score}</span>
            </div>
          )}
        </div>
      );
      
    case 'profile_updated':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <span>Updated: {metadata.fieldsUpdated?.join(', ') || 'profile'}</span>
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
              <span className="font-medium">{metadata.trackerName}</span>
            </div>
          )}
          {metadata.value !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>Value: <span className="font-bold">{metadata.value}</span></span>
            </div>
          )}
          {metadata.milestone && (
            <div className="flex items-center gap-1 text-sm text-green-500">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Milestone: {metadata.milestone}</span>
            </div>
          )}
          {metadata.recorderName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Recorded by: {metadata.recorderName}</span>
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

// Users icon for competition teams
function Users({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

interface ActivityItemProps {
  activity: AgentActivity;
  isFirst?: boolean;
  isLast?: boolean;
  className?: string;
}

export function ActivityItem({ activity, isFirst, isLast, className }: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const Icon = getActivityIcon(activity.type);
  const config = ActivityTypeConfig[activity.type];
  
  // Check if this activity has details to expand
  const hasDetails = activity.metadata && Object.keys(activity.metadata).length > 0;
  
  // Determine display title: richMessage takes priority
  const displayTitle = activity.richMessage || activity.title;
  
  // Determine agent name for display (fallback to Unknown Agent)
  const agentName = activity.agentName || 'Unknown Agent';
  
  // Check if recorder is different from agent
  const showRecorder = activity.recorderName && activity.recorderName !== activity.agentName;
  
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
                  {activity.type === 'competition_completed' && (activity.metadata as { rank?: number })?.rank && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      ((activity.metadata as { rank?: number }).rank ?? 0) === 1 
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : ((activity.metadata as { rank?: number }).rank ?? 0) <= 3
                          ? 'bg-gray-500/20 text-gray-400'
                          : 'bg-glass text-muted-foreground'
                    )}>
                      #{(activity.metadata as { rank?: number }).rank}
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
                  <span title={formatFullTimestamp(activity.timestamp)}>
                    {formatTimestamp(activity.timestamp)}
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
