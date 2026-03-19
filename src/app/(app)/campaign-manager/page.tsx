'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, ShieldCheck, Megaphone, Crown, Activity } from "lucide-react";
import { collection, query, orderBy, getCountFromServer, doc, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import type { AppUser } from '@/services/user';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Timestamp } from 'firebase/firestore';

interface Competition {
  id: string;
  name: string;
  startDate: any;
  endDate: any;
  podIds?: string[];
  status?: string;
}

interface Pod {
  id: string;
  name: string;
  managerId?: string;
}

interface DailyAchievementLog {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  date: any;
}

interface Team {
  id: string;
  name: string;
  podId: string;
}

export default function CampaignManagerDashboard() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [stats, setStats] = useState({
    totalPods: 0,
    totalAgents: 0,
    activeCompetitions: 0,
    weeklyAchievements: 0,
  });
  const [pods, setPods] = useState<Pod[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<DailyAchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch pods count
        const podsQuery = query(collection(db, 'pods'), orderBy('name'));
        const podsSnap = await getCountFromServer(podsQuery);
        
        // Fetch agents count
        const agentsQuery = query(collection(db, 'users'), where('roles', 'array-contains', 'agent'));
        const agentsSnap = await getCountFromServer(agentsQuery);

        if (isMounted) {
          setStats(prev => ({
            ...prev,
            totalPods: podsSnap.data().count,
            totalAgents: agentsSnap.data().count,
          }));
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    // Subscribe to competitions for active count
    const compUnsub = onSnapshot(query(collection(db, 'competitions'), orderBy('startDate', 'desc')), (snap) => {
      const comps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Competition));
      setCompetitions(comps);
      
      const now = new Date();
      const activeCount = comps.filter(c => {
        const start = c.startDate?.toDate();
        const end = c.endDate?.toDate();
        return start && end && now >= start && now <= end;
      }).length;
      
      setStats(prev => ({ ...prev, activeCompetitions: activeCount }));
    });
    unsubscribes.push(compUnsub);

    // Subscribe to pods
    const podsUnsub = onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => {
      setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)));
    });
    unsubscribes.push(podsUnsub);

    // Subscribe to achievements for weekly count
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const achievementsUnsub = onSnapshot(
      query(
        collection(db, 'dailyAchievements'),
        where('date', '>=', Timestamp.fromDate(weekStart)),
        where('date', '<=', Timestamp.fromDate(weekEnd))
      ),
      (snap) => {
        setAchievements(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog)));
        setStats(prev => ({ ...prev, weeklyAchievements: snap.size }));
        setIsLoading(false);
      }
    );
    unsubscribes.push(achievementsUnsub);

    fetchData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const activeCompetitions = useMemo(() => {
    const now = new Date();
    return competitions.filter(c => {
      const start = c.startDate?.toDate();
      const end = c.endDate?.toDate();
      return start && end && now >= start && now <= end;
    });
  }, [competitions]);

  const podPerformance = useMemo(() => {
    const podAchievementCounts: Record<string, number> = {};
    achievements.forEach(a => {
      podAchievementCounts[a.podId] = (podAchievementCounts[a.podId] || 0) + 1;
    });
    
    return pods
      .map(pod => ({
        ...pod,
        achievementCount: podAchievementCounts[pod.id] || 0,
      }))
      .sort((a, b) => b.achievementCount - a.achievementCount)
      .slice(0, 5);
  }, [pods, achievements]);

  const miniApps = [
    {
      title: 'Competitions',
      description: 'Manage KPI competitions',
      href: '/competitions',
      icon: Trophy,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
    },
    {
      title: 'Trackers',
      description: 'Track team metrics',
      href: '/trackers',
      icon: Target,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Performance',
      description: 'View performance analytics',
      href: '/performance',
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
    },
    {
      title: 'Mini Games',
      description: 'Fun activities and games',
      href: '/mini-games',
      icon: Gamepad2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Campaign Manager Dashboard</h1>
        <p className="text-muted-foreground">Overview of campaigns and performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pods</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPods}</div>
            <p className="text-xs text-muted-foreground">Active teams</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAgents}</div>
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCompetitions}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyAchievements}</div>
            <p className="text-xs text-muted-foreground">Achievements logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Mini Apps Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Applications</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {miniApps.map((app) => {
            const Icon = app.icon;
            return (
              <Link key={app.href} href={app.href}>
                <Card variant="glass" className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className={`p-2 rounded-lg ${app.bgColor}`}>
                      <Icon className={`h-5 w-5 ${app.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg">{app.title}</CardTitle>
                    <CardDescription className="mt-1">{app.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Active Competitions */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Active Competitions
          </CardTitle>
          <CardDescription>
            Competitions currently running across all pods
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCompetitions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active competitions</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competition</TableHead>
                    <TableHead>Pods</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCompetitions.slice(0, 5).map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell>{comp.podIds?.length || 0} pods</TableCell>
                      <TableCell>{comp.startDate ? format(comp.startDate.toDate(), 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell>{comp.endDate ? format(comp.endDate.toDate(), 'MMM d, yyyy') : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pod Performance */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Pod Performance
          </CardTitle>
          <CardDescription>
            Pods ranked by achievements this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {podPerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Pod Name</TableHead>
                    <TableHead className="text-right">Achievements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {podPerformance.map((pod, index) => (
                    <TableRow key={pod.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {generateInitials(pod.name)}
                            </AvatarFallback>
                          </Avatar>
                          {pod.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{pod.achievementCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
