'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, Activity, TrendingUp } from "lucide-react";
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
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    points: number;
  }>;
}

interface DailyAchievementLog {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId?: string;
  date: string;
  value?: number;
}

interface Pod {
  id: string;
  name: string;
}

export default function CompetitionRunnerDashboard() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<DailyAchievementLog[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, compsRes, podsRes, achRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/competitions'),
          fetch('/api/pods'),
          fetch('/api/achievements'),
        ]);

        if (userRes.ok) {
          const data = await userRes.json();
          setCurrentUser(data.user);
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
        }
        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
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

  const competitionStats = useMemo(() => {
    return activeCompetitions.map(comp => {
      const compAchievements = achievements.filter(a => a.competitionId === comp.id);
      const uniqueAgents = new Set(compAchievements.map(a => a.agentId));
      const totalAchievements = compAchievements.length;
      const participationRate = comp.podIds && comp.podIds.length > 0 
        ? Math.round((uniqueAgents.size / (comp.podIds.length * 10)) * 100) // Estimate based on pods
        : 0;
      
      return {
        ...comp,
        totalAchievements,
        uniqueParticipants: uniqueAgents.size,
        participationRate: Math.min(participationRate, 100),
      };
    });
  }, [activeCompetitions, achievements]);

  const topPerformers = useMemo(() => {
    const agentCounts: Record<string, number> = {};
    achievements.forEach(a => {
      agentCounts[a.agentId] = (agentCounts[a.agentId] || 0) + 1;
    });
    
    return Object.entries(agentCounts)
      .map(([agentId, count]) => ({ agentId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [achievements]);

  const miniApps = [
    {
      title: 'Competitions',
      description: 'Manage competitions',
      href: '/competitions',
      icon: Trophy,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
    },
    {
      title: 'Trackers',
      description: 'Track metrics',
      href: '/trackers',
      icon: Target,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Performance',
      description: 'View analytics',
      href: '/performance',
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
    },
    {
      title: 'Mini Games',
      description: 'Fun activities',
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
        <h1 className="text-3xl font-bold">Competition Runner Dashboard</h1>
        <p className="text-muted-foreground">Overview of active competitions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCompetitions.length}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(achievements.map(a => a.agentId)).size}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievements.length}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Pod</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pods.length > 0 ? pods[0]?.name.slice(0, 10) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Most active</p>
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
            Competition progress and statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {competitionStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active competitions</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competition</TableHead>
                    <TableHead>Pods</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Achievements</TableHead>
                    <TableHead>Date Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitionStats.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell>{(comp as any).podIds?.length || 0}</TableCell>
                      <TableCell>{comp.uniqueParticipants}</TableCell>
                      <TableCell>{comp.totalAchievements}</TableCell>
                      <TableCell>
                        {comp.startsAt && comp.endsAt 
                          ? `${format(new Date(comp.startsAt), 'MMM d')} - ${format(new Date(comp.endsAt), 'MMM d')}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Performers
          </CardTitle>
          <CardDescription>
            Agents with the most achievements this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topPerformers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Achievements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPerformers.map((performer, index) => (
                    <TableRow key={performer.agentId}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              Agent {index + 1}
                            </AvatarFallback>
                          </Avatar>
                          {performer.agentId.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{performer.count}</TableCell>
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
