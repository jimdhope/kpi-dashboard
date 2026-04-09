'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, ShieldCheck, Megaphone, Crown, Activity } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AppUser {
  id: string;
  name?: string;
  podId?: string;
}

interface Competition {
  id: string;
  name: string;
  startsAt?: string;
  endsAt?: string;
}

interface Pod {
  id: string;
  name: string;
}

interface DailyAchievementLog {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  date: string;
}

export default function CampaignManagerDashboard() {
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
    async function fetchData() {
      try {
        const [podsRes, usersRes, compsRes, achRes] = await Promise.all([
          fetch('/api/pods'),
          fetch('/api/users'),
          fetch('/api/competitions'),
          fetch('/api/achievements'),
        ]);

        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          const agents = (data.users || []).length;
          setStats(prev => ({ ...prev, totalAgents: agents }));
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
          const now = new Date();
          const activeCount = (data.competitions || []).filter((c: Competition) => {
            const start = c.startsAt ? new Date(c.startsAt) : null;
            const end = c.endsAt ? new Date(c.endsAt) : null;
            return start && end && now >= start && now <= end;
          }).length;
          setStats(prev => ({ ...prev, activeCompetitions: activeCount }));
        }
        if (achRes.ok) {
          const data = await achRes.json();
          setAchievements(data.achievements || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const activeCompetitions = useMemo(() => {
    const now = new Date();
    return competitions.filter(c => {
      const start = c.startsAt ? new Date(c.startsAt) : null;
      const end = c.endsAt ? new Date(c.endsAt) : null;
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
                      <TableCell>{(comp as any).podIds?.length || 0} pods</TableCell>
                      <TableCell>{comp.startsAt ? format(new Date(comp.startsAt), 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell>{comp.endsAt ? format(new Date(comp.endsAt), 'MMM d, yyyy') : '-'}</TableCell>
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
