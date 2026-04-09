'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, ShieldCheck, Crown } from "lucide-react";
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

interface Pod {
  id: string;
  name: string;
}

interface Competition {
  id: string;
  name: string;
  startsAt?: string;
  endsAt?: string;
}

interface DailyAchievementLog {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  date: string;
}

export default function PodManagerDashboard() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<DailyAchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, podsRes, usersRes, compsRes, achRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/pods'),
          fetch('/api/users'),
          fetch('/api/competitions'),
          fetch('/api/achievements'),
        ]);

        if (userRes.ok) {
          const data = await userRes.json();
          setCurrentUser(data.user);
        }
        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setAgents(data.users || []);
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
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

  const myPodIds = useMemo(() => currentUser?.podId ? [currentUser.podId] : [], [currentUser?.podId]);

  const myPods = useMemo(() => {
    return pods.filter(p => myPodIds.includes(p.id));
  }, [pods, myPodIds]);

  const myAgents = useMemo(() => {
    return agents.filter(a => a.podId && myPodIds.includes(a.podId));
  }, [agents, myPodIds]);

  const activeCompetitions = useMemo(() => {
    const now = new Date();
    return competitions.filter(c => {
      const start = c.startsAt ? new Date(c.startsAt) : null;
      const end = c.endsAt ? new Date(c.endsAt) : null;
      return start && end && now >= start && now <= end;
    });
  }, [competitions]);

  const weeklyAchievements = useMemo(() => {
    return achievements.filter(a => myPodIds.includes(a.podId));
  }, [achievements, myPodIds]);

  const teamLeaderboard = useMemo(() => {
    const agentAchievementCounts: Record<string, number> = {};
    weeklyAchievements.forEach(a => {
      agentAchievementCounts[a.agentId] = (agentAchievementCounts[a.agentId] || 0) + 1;
    });

    return myAgents
      .filter(agent => agent.id)
      .map(agent => ({
        ...agent,
        achievementCount: agent.id ? (agentAchievementCounts[agent.id] || 0) : 0,
      }))
      .sort((a, b) => b.achievementCount - a.achievementCount)
      .slice(0, 10);
  }, [myAgents, weeklyAchievements]);

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
        <h1 className="text-3xl font-bold">Pod Manager Dashboard</h1>
        <p className="text-muted-foreground">Overview of your pods and teams</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Pods</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myPods.length}</div>
            <p className="text-xs text-muted-foreground">Pods managed</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Leaders</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myPods.length}</div>
            <p className="text-xs text-muted-foreground">Active teams</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCompetitions.length}</div>
            <p className="text-xs text-muted-foreground">In your pods</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyAchievements.length}</div>
            <p className="text-xs text-muted-foreground">Achievements</p>
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

      {/* Team Leaderboard */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Team Leaderboard
          </CardTitle>
          <CardDescription>
            Top performers in your pods this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamLeaderboard.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Pod</TableHead>
                    <TableHead className="text-right">Achievements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamLeaderboard.map((agent, index) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {generateInitials(agent.name || '')}
                            </AvatarFallback>
                          </Avatar>
                          {agent.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {myPods.find(p => p.id === agent.podId)?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{agent.achievementCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Pods */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            My Pods
          </CardTitle>
          <CardDescription>
            Pods you manage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myPods.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pods assigned</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myPods.map((pod) => {
                const podAgents = myAgents.filter(a => a.podId === pod.id);
                return (
                  <Card key={pod.id} className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {generateInitials(pod.name)}
                          </AvatarFallback>
                        </Avatar>
                        {pod.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {podAgents.length} agents
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
