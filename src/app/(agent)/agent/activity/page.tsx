'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Clock, Trophy, Target, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser, ActivityRecord } from '@/lib/contracts';

export default function AgentActivityPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [stats, setStats] = useState({
    competitions: 0,
    scoresLogged: 0,
    totalPoints: 0,
    daysActive: 0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch session
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.authenticated && sessionData.user) {
            setCurrentUser(sessionData.user);
          }
        }

        // Fetch activities
        if (currentUser?.id) {
          const activitiesRes = await fetch('/api/activities');
          if (activitiesRes.ok) {
            const data = await activitiesRes.json();
            setActivities(data.activities || []);
            
            // Calculate stats
            const activityData = data.activities || [];
            setStats({
              competitions: new Set(activityData.filter((a: any) => a.type === 'competition')).size,
              scoresLogged: activityData.filter((a: any) => a.type === 'performance_log').length,
              totalPoints: activityData.reduce((sum: number, a: any) => sum + (a.metadataJson?.points || 0), 0),
              daysActive: new Set(activityData.map((a: any) => a.createdAt?.split('T')[0])).size,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setIsLoading(false);
    }
    fetchData();
  }, [currentUser?.id]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'competition':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'performance_log':
        return <Target className="h-4 w-4 text-green-500" />;
      case 'achievement':
        return <Star className="h-4 w-4 text-purple-500" />;
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
            Activity History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your journey and achievements over time
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.competitions}</p>
              <p className="text-xs text-muted-foreground">Competitions</p>
            </div>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Target className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.scoresLogged}</p>
              <p className="text-xs text-muted-foreground">Scores Logged</p>
            </div>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Star className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.daysActive}</p>
              <p className="text-xs text-muted-foreground">Days Active</p>
            </div>
          </div>
        </Card>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No activity recorded yet. Start logging scores to see your history here.
            </p>
          ) : (
            <div className="space-y-4">
              {activities.slice(0, 50).map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-muted/30 last:border-0">
                  <div className="p-2 rounded-lg bg-muted/50">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.createdAt ? format(new Date(activity.createdAt), 'PPp') : ''}
                    </p>
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
