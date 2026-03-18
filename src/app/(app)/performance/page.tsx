'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, LineChart, Settings, CheckSquare, TrendingUp, Star, Users } from "lucide-react";
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface AdditionalKpi {
  id: string;
  name: string;
  emoji?: string;
}

interface AdditionalKpiLog {
  id: string;
  podId?: string;
  date?: any;
  scores?: Record<string, number>;
}

interface Pod {
  id: string;
  name: string;
}

interface AppUser {
  id: string;
  name?: string;
}

export default function PerformanceDashboard() {
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [kpiLogs, setKpiLogs] = useState<AdditionalKpiLog[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch KPIs
        const kpisQuery = query(collection(db, 'additionalKpis'), orderBy('name'));
        unsubscribes.push(onSnapshot(kpisQuery, (snapshot) => {
          if (isMounted) {
            setKpis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdditionalKpi)));
          }
        }));

        // Fetch pods
        const podsQuery = query(collection(db, 'pods'), orderBy('name'));
        unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
          if (isMounted) {
            setPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
          }
        }));

        // Fetch users
        const usersQuery = query(collection(db, 'users'), orderBy('name'));
        unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
          if (isMounted) {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
          }
        }));

        // Fetch KPI logs
        const logsQuery = query(collection(db, 'additionalKpiLogs'), orderBy('date', 'desc'));
        unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
          if (isMounted) {
            setKpiLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdditionalKpiLog)));
            setIsLoading(false);
          }
        }));
      } catch (error) {
        console.error("Error fetching performance data:", error);
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const totalKpis = kpis.length;
  const totalLogs = kpiLogs.length;
  
  // Calculate unique agents with scores
  const uniqueAgentsWithScores = new Set(
    kpiLogs.flatMap(log => Object.keys(log.scores || {}))
  ).size;

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
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">KPI performance tracking and analytics</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total KPIs</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalKpis}</div>
            <p className="text-xs text-muted-foreground">Active KPIs tracked</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Logs</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLogs}</div>
            <p className="text-xs text-muted-foreground">Entries recorded</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">With performance data</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pods</CardTitle>
            <Star className="h-4 w-4 text-primary" />
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
            <CardTitle>Active KPIs</CardTitle>
            <CardDescription>Performance metrics being tracked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kpis.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No KPIs configured yet</p>
              ) : (
                kpis.slice(0, 5).map((kpi) => (
                  <div key={kpi.id} className="flex items-center p-3 rounded-lg bg-glass/30">
                    <BarChart3 className="h-8 w-8 mr-3 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{kpi.name}</p>
                      <p className="text-xs text-muted-foreground">{kpi.emoji || '📊'} Performance metric</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Recent Performance Logs</CardTitle>
            <CardDescription>Latest KPI score entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kpiLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No performance logs yet</p>
              ) : (
                kpiLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center p-3 rounded-lg bg-glass/30">
                    <TrendingUp className="h-8 w-8 mr-3 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Performance Log Entry</p>
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
            <CardDescription>Common performance operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a href="/performance/kpis" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <p className="text-sm font-medium">Setup KPIs</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Configure performance metrics</p>
              </a>
              <a href="/performance/log" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <p className="text-sm font-medium">Log Scores</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Record daily KPI scores</p>
              </a>
              <a href="/performance/breakdown" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <p className="text-sm font-medium">KPI Breakdown</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">View detailed KPI analysis</p>
              </a>
              <a href="/performance/charts" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  <p className="text-sm font-medium">Performance Charts</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Visual performance trends</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
