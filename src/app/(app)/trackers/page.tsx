'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Settings, CheckSquare, TrendingUp, Users } from "lucide-react";
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface TrackerKpi {
  id: string;
  name: string;
  initials: string;
}

interface TrackerLog {
  id: string;
  podId?: string;
  date?: any;
  scores?: Record<string, number>;
}

interface Pod {
  id: string;
  name: string;
}

export default function TrackersDashboard() {
  const [trackerKpis, setTrackerKpis] = useState<TrackerKpi[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch tracker KPIs
        const kpisQuery = query(collection(db, 'trackerKpis'), orderBy('name'));
        unsubscribes.push(onSnapshot(kpisQuery, (snapshot) => {
          if (isMounted) {
            setTrackerKpis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackerKpi)));
          }
        }));

        // Fetch pods
        const podsQuery = query(collection(db, 'pods'), orderBy('name'));
        unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
          if (isMounted) {
            setPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
          }
        }));

        // Fetch tracker logs
        const logsQuery = query(collection(db, 'trackerLogs'), orderBy('date', 'desc'));
        unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
          if (isMounted) {
            setTrackerLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackerLog)));
            setIsLoading(false);
          }
        }));
      } catch (error) {
        console.error("Error fetching trackers data:", error);
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const activeTrackers = trackerKpis.length;
  const totalLogs = trackerLogs.length;
  const uniquePodsWithLogs = new Set(trackerLogs.map(l => l.podId)).size;

  // Calculate completion rate (pods with logs / total pods)
  const completionRate = pods.length > 0 ? Math.round((uniquePodsWithLogs / pods.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} variant="glass">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trackers Dashboard</h1>
          <p className="text-muted-foreground">Campaign-wide tracker overview</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trackers</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTrackers}</div>
            <p className="text-xs text-muted-foreground">Tracker KPIs defined</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLogs}</div>
            <p className="text-xs text-muted-foreground">Entries recorded</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">{uniquePodsWithLogs} of {pods.length} pods</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pods.length}</div>
            <p className="text-xs text-muted-foreground">Active pods</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Active Trackers</CardTitle>
            <CardDescription>Configured tracker KPIs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trackerKpis.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No trackers configured yet</p>
              ) : (
                trackerKpis.slice(0, 5).map((kpi) => (
                  <div key={kpi.id} className="flex items-center p-3 rounded-lg bg-glass/30">
                    <Target className="h-8 w-8 mr-3 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{kpi.name}</p>
                      <p className="text-xs text-muted-foreground">Initials: {kpi.initials}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Recent Tracker Activity</CardTitle>
            <CardDescription>Latest updates from campaign trackers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trackerLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tracker logs yet</p>
              ) : (
                trackerLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center p-3 rounded-lg bg-glass/30">
                    <CheckSquare className="h-8 w-8 mr-3 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Tracker Log Entry</p>
                      <p className="text-xs text-muted-foreground">
                        {log.date?.toDate ? format(log.date.toDate(), 'MMM d, yyyy') : 'Unknown date'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Object.keys(log.scores || {}).length} scores
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tracker operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a href="/trackers/setup" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <p className="text-sm font-medium">Setup New Tracker</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Create a new campaign tracker</p>
              </a>
              <a href="/trackers/log" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <p className="text-sm font-medium">Log Scores</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Record tracker data</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
