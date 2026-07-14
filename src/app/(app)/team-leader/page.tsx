'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, Activity } from "lucide-react";
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

interface Team {
  id: string;
  name: string;
  emoji?: string;
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

export default function TeamLeaderDashboard() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<DailyAchievementLog[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, compsRes, achRes, usersRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/competitions'),
          fetch('/api/achievements'),
          fetch('/api/users'),
        ]);

        if (userRes.ok) {
          const data = await userRes.json();
          setCurrentUser(data.user);
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
        }
        if (achRes.ok) {
          const data = await achRes.json();
          setAchievements(data.achievements || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const myPodAgents = useMemo(() => {
    if (!currentUser?.podId) return [];
    return users.filter(u => u.podId === currentUser.podId);
  }, [users, currentUser?.podId]);

  const teamAchievements = useMemo(() => {
    const agentIds = myPodAgents.map(a => a.id);
    return achievements.filter(a => agentIds.includes(a.agentId));
  }, [achievements, myPodAgents]);

  const activeCompetitions = useMemo(() => {
    const now = new Date();
    return competitions.filter(c => {
      const start = c.startsAt ? new Date(c.startsAt) : null;
      const end = c.endsAt ? new Date(c.endsAt) : null;
      return start && end && now >= start && now <= end;
    });
  }, [competitions]);

  const agentLeaderboard = useMemo(() => {
    const agentAchievementCounts: Record<string, number> = {};
    teamAchievements.forEach(a => {
      agentAchievementCounts[a.agentId] = (agentAchievementCounts[a.agentId] || 0) + 1;
    });

    return myPodAgents
      .filter(agent => agent.id)
      .map(agent => ({
        ...agent,
        achievementCount: agent.id ? (agentAchievementCounts[agent.id] || 0) : 0,
      }))
      .sort((a, b) => b.achievementCount - a.achievementCount);
  }, [myPodAgents, teamAchievements]);

  const teamRank = useMemo(() => {
    const totalAchievements = teamAchievements.length;
    return totalAchievements > 0 ? 1 : '-';
  }, [teamAchievements]);

  const miniApps = [
    {
      title: 'Competitions',
      description: 'View competitions',
      href: '/competitions',
      icon: Trophy,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
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
        <h1 className="text-3xl font-bold">Team Leader Dashboard</h1>
        <p className="text-muted-foreground">Overview of your team</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentUser?.name || 'Team'}</div>
            <p className="text-xs text-muted-foreground">Assigned team</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myPodAgents.length}</div>
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCompetitions.length}</div>
            <p className="text-xs text-muted-foreground">For your team</p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamAchievements.length}</div>
            <p className="text-xs text-muted-foreground">Team achievements</p>
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
            Agent performance this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!currentUser?.podId ? (
            <p className="text-muted-foreground text-center py-8">No pod assigned</p>
          ) : agentLeaderboard.length === 0 ? (
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
                  {agentLeaderboard.map((agent, index) => (
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
                      <TableCell className="text-right font-medium">{agent.achievementCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Competitions */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Active Competitions
          </CardTitle>
          <CardDescription>
            Competitions your team is participating in
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
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCompetitions.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
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
    </div>
  );
}
