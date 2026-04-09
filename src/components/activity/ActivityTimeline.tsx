'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { Activity, Trophy, Target, BarChart3, Gamepad2, Award, Filter, RefreshCw, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ActivityItem, ActivityItemSkeleton } from './ActivityItem';
import type { 
  ActivityRecord, 
  ActivityCategory, 
  DateRangePreset,
} from '@/lib/contracts';
import { 
  ACTIVITY_CATEGORY_LABELS,
  ACTIVITY_TYPE_CATEGORIES,
  getActivitiesByCategory,
} from '@/lib/contracts';

// Date range preset configurations
const dateRangePresets: { value: DateRangePreset; label: string; getRange: () => { start: Date; end: Date } }[] = [
  {
    value: 'all',
    label: 'All Time',
    getRange: () => ({ start: new Date(0), end: new Date() }),
  },
  {
    value: 'today',
    label: 'Today',
    getRange: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }),
  },
  {
    value: 'week',
    label: 'Last 7 Days',
    getRange: () => ({ start: startOfDay(subDays(new Date(), 7)), end: endOfDay(new Date()) }),
  },
  {
    value: 'month',
    label: 'Last 30 Days',
    getRange: () => ({ start: startOfDay(subDays(new Date(), 30)), end: endOfDay(new Date()) }),
  },
  {
    value: 'quarter',
    label: 'Last 90 Days',
    getRange: () => ({ start: startOfDay(subMonths(new Date(), 3)), end: endOfDay(new Date()) }),
  },
];

// Category icons
const categoryIcons: Record<Exclude<ActivityCategory, 'all'>, React.ElementType> = {
  trackers: Target,
  competitions: Trophy,
  scores: Award,
  kpis: BarChart3,
  games: Gamepad2,
  profile: Target,
};

interface ActivityTimelineProps {
  userId?: string;
  className?: string;
  initialCategory?: ActivityCategory;
  pageSize?: number;
  onActivitiesLoaded?: (activities: ActivityRecord[]) => void;
}

export function ActivityTimeline({ 
  userId,
  className, 
  initialCategory = 'all',
  pageSize = 20,
  onActivitiesLoaded,
}: ActivityTimelineProps) {
  // State
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ActivityCategory>(initialCategory);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('month');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [total, setTotal] = useState(0);
  
  // Get date range from preset
  const dateRange = useMemo(() => {
    const preset = dateRangePresets.find(p => p.value === dateRangePreset);
    return preset?.getRange() || { start: new Date(0), end: new Date() };
  }, [dateRangePreset]);

  // Fetch activities from API
  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (category !== 'all') params.append('category', category);
      if (dateRangePreset !== 'all') {
        params.append('startDate', dateRange.start.toISOString());
        params.append('endDate', dateRange.end.toISOString());
      }
      params.append('limit', '500'); // Fetch many for client-side filtering

      const res = await fetch(`/api/activities?${params.toString()}`);
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please log in to view activities');
        }
        throw new Error('Failed to load activities');
      }

      const data = await res.json();
      setActivities(data.activities || []);
      setTotal(data.total || 0);
      
      if (onActivitiesLoaded) {
        onActivitiesLoaded(data.activities || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [userId, category, dateRangePreset, dateRange, onActivitiesLoaded]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [category, dateRangePreset]);

  // Filter activities (client-side for immediate UI response)
  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    // Filter by category (already done server-side, but double-check)
    if (category !== 'all') {
      filtered = getActivitiesByCategory(filtered, category);
    }
    
    // Filter by date range
    filtered = filtered.filter(activity => {
      const timestamp = new Date(activity.createdAt);
      return timestamp >= dateRange.start && timestamp <= dateRange.end;
    });
    
    return filtered;
  }, [activities, category, dateRange]);

  // Count activities by category
  const categoryCounts = useMemo(() => {
    const counts: Record<ActivityCategory, number> = {
      all: activities.length,
      trackers: 0,
      competitions: 0,
      scores: 0,
      kpis: 0,
      games: 0,
      profile: 0,
    };

    activities.forEach(activity => {
      const cat = ACTIVITY_TYPE_CATEGORIES[activity.type as keyof typeof ACTIVITY_TYPE_CATEGORIES];
      if (cat && cat !== 'all') {
        counts[cat]++;
      }
    });

    return counts;
  }, [activities]);

  // Get categories with activities
  const availableCategories = useMemo(() => {
    return (['all', 'trackers', 'competitions', 'scores', 'kpis', 'games'] as ActivityCategory[]).filter(
      cat => cat === 'all' || categoryCounts[cat] > 0
    );
  }, [categoryCounts]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    fetchActivities();
  }, [fetchActivities]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filters */}
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Category filter */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter by Category</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const Icon = cat === 'all' ? Activity : categoryIcons[cat as Exclude<ActivityCategory, 'all'>];
                  const isSelected = category === cat;
                  
                  return (
                    <Button
                      key={cat}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'gap-2',
                        isSelected && 'bg-primary'
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{ACTIVITY_CATEGORY_LABELS[cat]}</span>
                      <Badge 
                        variant={isSelected ? 'secondary' : 'outline'}
                        className="ml-1 h-5 px-1.5"
                      >
                        {categoryCounts[cat]}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
            
            {/* Date range and refresh */}
            <div className="flex gap-3 items-end">
              <div className="w-40">
                <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Time Period
                </label>
                <Select 
                  value={dateRangePreset} 
                  onValueChange={(value) => setDateRangePreset(value as DateRangePreset)}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRangePresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex-shrink-0"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Showing {filteredActivities.length} of {total} activities
              {dateRangePreset !== 'all' && (
                <span> ({format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d')})</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Activity Timeline */}
      <Card variant="glass">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <ActivityItemSkeleton key={i} isFirst={i === 0} isLast={i === 4} />
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-destructive/30 mb-4" />
              <h3 className="text-lg font-medium mb-2 text-destructive">Error Loading Activities</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                {error}
              </p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : filteredActivities.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No activities found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {category !== 'all'
                  ? `You haven't had any ${ACTIVITY_CATEGORY_LABELS[category].toLowerCase()} activities yet.`
                  : "You don't have any recorded activities yet. Start logging your achievements to see them here."}
              </p>
              {category !== 'all' && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setCategory('all')}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            // Activity list
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {filteredActivities.slice(0, currentPage * pageSize).map((activity, index) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isFirst={index === 0}
                    isLast={index === Math.min(currentPage * pageSize, filteredActivities.length) - 1}
                  />
                ))}
              </div>
              
              {/* Load more */}
              {currentPage * pageSize < filteredActivities.length && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="gap-2"
                  >
                    Load More
                    <span className="text-muted-foreground">
                      ({filteredActivities.length - currentPage * pageSize} remaining)
                    </span>
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simplified timeline for embedding in other pages
interface MiniActivityTimelineProps {
  userId?: string;
  limit?: number;
  className?: string;
}

export function MiniActivityTimeline({ userId, limit = 5, className }: MiniActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const params = new URLSearchParams();
        if (userId) params.append('userId', userId);
        params.append('limit', String(limit));

        const res = await fetch(`/api/activities?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivities();
  }, [userId, limit]);

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <Activity className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No recent activities</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {activities.map((activity, index) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          isFirst={index === 0}
          isLast={index === activities.length - 1}
        />
      ))}
    </div>
  );
}
