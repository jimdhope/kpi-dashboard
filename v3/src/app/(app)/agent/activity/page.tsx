'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Clock, Trophy, Target, Star, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppUser, ActivityRecord } from '@/lib/contracts';
import { ActivityTimeline } from '@/components/activity';

export default function AgentActivityPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [stats, setStats] = useState({
    competitions: 0,
    trackers: 0,
    kpis: 0,
    games: 0,
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
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  // Calculate stats from activities
  const handleActivitiesLoaded = (loadedActivities: ActivityRecord[]) => {
    setActivities(loadedActivities);
    
    // Calculate stats
    const activityData = loadedActivities;
    const uniqueDays = new Set(activityData.map((a) => a.createdAt?.split('T')[0]));
    
    setStats({
      competitions: activityData.filter((a) => a.type.startsWith('competition')).length,
      trackers: activityData.filter((a) => a.type.startsWith('tracker')).length,
      kpis: activityData.filter((a) => a.type.startsWith('kpi')).length,
      games: activityData.filter((a) => a.type.startsWith('game')).length,
      totalPoints: activityData.reduce((sum, a) => sum + (a.metadataJson?.points as number || 0), 0),
      daysActive: uniqueDays.size,
    });
  };

  if (isLoading || !currentUser) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            <div className="p-2 rounded-lg bg-teal-500/20">
              <Target className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.trackers}</p>
              <p className="text-xs text-muted-foreground">Trackers</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.kpis}</p>
              <p className="text-xs text-muted-foreground">KPIs</p>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Star className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.games}</p>
              <p className="text-xs text-muted-foreground">Games</p>
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

      <ActivityTimeline 
        userId={currentUser.id}
        onActivitiesLoaded={handleActivitiesLoaded}
      />
    </div>
  );
}
