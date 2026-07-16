'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Clock, Trophy, Target, Gamepad2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser, ActivityRecord } from '@/lib/contracts';

type Category = 'all' | 'competitions' | 'kpis' | 'trackers' | 'games';

interface CategoryInfo {
  id: Category;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  types: string[];
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'all', label: 'All Activity', icon: <Activity className="h-5 w-5" />, color: 'text-blue-500', bgColor: 'bg-blue-500/20', types: [] },
  { id: 'competitions', label: 'Competitions', icon: <Trophy className="h-5 w-5" />, color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', types: ['competition_started', 'competition_joined', 'competition_completed', 'competition_won', 'competition_score_logged', 'competition_milestone', 'competition_absent', 'achievement_earned', 'milestone_reached', 'badge_earned'] },
  { id: 'kpis', label: 'KPI Updates', icon: <Target className="h-5 w-5" />, color: 'text-green-500', bgColor: 'bg-green-500/20', types: ['kpi_updated', 'kpi_created', 'kpi_goal_reached', 'kpi_goal_achieved', 'kpi_trend_improved'] },
  { id: 'games', label: 'Games', icon: <Gamepad2 className="h-5 w-5" />, color: 'text-orange-500', bgColor: 'bg-orange-500/20', types: ['game_played', 'game_won', 'game_high_score', 'game_achievement'] },
];

export default function AgentActivityPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [activityScope, setActivityScope] = useState<'own' | 'all'>('own');

  useEffect(() => {
    async function fetchData() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.authenticated && sessionData.user) {
            setCurrentUser(sessionData.user);
            const activitiesRes = await fetch('/api/activities?limit=100');
            if (activitiesRes.ok) {
              const data = await activitiesRes.json();
              setActivities(data.activities || []);
              setActivityScope(data.scope === 'all' ? 'all' : 'own');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  // Get latest activity for each category
  const getCategoryLatest = (category: CategoryInfo) => {
    // For "all" category, return the first (most recent) activity overall
    if (category.types.length === 0) {
      return activities.length > 0 ? activities[0] : null;
    }
    return activities.find(a => category.types.includes(a.type));
  };

  // Filter activities based on selected category
  const filteredActivities = selectedCategory === 'all' 
    ? activities 
    : activities.filter(a => {
        const category = CATEGORIES.find(c => c.id === selectedCategory);
        return category?.types.includes(a.type) ?? false;
      });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'competition_started':
      case 'competition_joined':
      case 'competition_completed':
      case 'competition_won':
      case 'competition_score_logged':
      case 'competition_milestone':
      case 'competition_absent':
      case 'achievement_earned':
      case 'milestone_reached':
      case 'badge_earned':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'kpi_updated':
      case 'kpi_created':
      case 'kpi_goal_reached':
      case 'kpi_goal_achieved':
      case 'kpi_trend_improved':
        return <Target className="h-4 w-4 text-green-500" />;
      case 'game_played':
      case 'game_won':
      case 'game_high_score':
      case 'game_achievement':
        return <Gamepad2 className="h-4 w-4 text-orange-500" />;
      case 'tracker_entry_logged':
      case 'tracker_created':
      case 'tracker_milestone':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  if (isLoading || !currentUser) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            {activityScope === 'all' ? 'Activity History' : 'My Activity'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {activityScope === 'all'
              ? 'Review activity and achievements across the organisation'
              : 'Track your journey and achievements over time'}
          </p>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((category) => {
          const latest = getCategoryLatest(category);
          const isSelected = selectedCategory === category.id;
          
          return (
            <Card 
              key={category.id}
              variant="glass" 
              className={`p-4 cursor-pointer transition-all hover:scale-[1.02] ${isSelected ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${category.bgColor}`}>
                  <span className={category.color}>{category.icon}</span>
                </div>
                <span className="font-medium text-sm">{category.label}</span>
              </div>
              {latest ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground truncate">
                    {latest.agentName || latest.userName || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {latest.title}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No activity yet</p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Activity List */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>
            {CATEGORIES.find(c => c.id === selectedCategory)?.label || 'Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No activity recorded yet. Start logging scores to see your history here.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredActivities.slice(0, 50).map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-muted/30 last:border-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/20">
                      {generateInitials(activity.agentName || activity.userName || '?')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.agentName || activity.userName || 'Unknown'}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{activity.title}</span>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Changed by:{' '}
                      <span className="font-medium text-foreground/80">
                        {activity.recorderName
                          || (activity.recorderId && activity.recorderId === activity.userId
                            ? activity.agentName || activity.userName
                            : null)
                          || 'Not recorded'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.createdAt ? format(new Date(activity.createdAt), 'PPp') : ''}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    {getActivityIcon(activity.type)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
