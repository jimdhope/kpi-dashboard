'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, Megaphone, ShieldCheck, ArrowRight, Medal } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { AppUser, CompetitionRecord, AppPod, PerformanceLogRecord } from '@/lib/contracts';

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [pods, setPods] = useState<AppPod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<PerformanceLogRecord[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<any[]>([]);

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

        // Fetch competitions
        const compsRes = await fetch('/api/competitions');
        if (compsRes.ok) {
          const compsData = await compsRes.json();
          setCompetitions(compsData.competitions || []);
        }

        // Fetch pods
        const podsRes = await fetch('/api/pods');
        if (podsRes.ok) {
          const podsData = await podsRes.json();
          setPods(podsData.pods || []);
        }

        // Fetch users
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        }

        // Fetch tracker logs
        const logsRes = await fetch('/api/performance/logs');
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setTrackerLogs(logsData.logs || []);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const latestCompetition = useMemo(() => {
    if (competitions.length === 0) return null;
    const now = new Date();
    for (const comp of competitions) {
      const start = comp.startsAt ? new Date(comp.startsAt) : null;
      const end = comp.endsAt ? new Date(comp.endsAt) : null;
      if (start && end && start <= now && end >= now) {
        return comp;
      }
    }
    return competitions[0];
  }, [competitions]);

  const todayLogs = useMemo(() => {
    const today = new Date().toDateString();
    return trackerLogs.filter(log => {
      const logDate = new Date(log.loggedAt).toDateString();
      return logDate === today;
    });
  }, [trackerLogs]);

  const trackerLeaderboard = useMemo(() => {
    const agentScores: Record<string, { id: string; name: string; podName: string; score: number }> = {};
    todayLogs.forEach(log => {
      if (!agentScores[log.userId || '']) {
        const user = users.find(u => u.id === log.userId);
        agentScores[log.userId || ''] = {
          id: log.userId || '',
          name: user?.name || 'Unknown',
          podName: 'Unknown Pod',
          score: 0
        };
      }
      agentScores[log.userId || ''].score += log.value;
    });
    return Object.values(agentScores).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [todayLogs, users, pods]);

  const podPerformance = useMemo(() => {
    return pods.map(pod => ({
      id: pod.id,
      name: pod.name,
      achievementScore: 0,
      trackerScore: todayLogs
        .filter(log => {
          const user = users.find(u => u.id === log.userId);
          return user?.roles?.some(r => r.includes(pod.id));
        })
        .reduce((sum, log) => sum + log.value, 0),
      agentCount: users.filter(u => u.roles?.some(r => r.includes(pod.id))).length,
    })).sort((a, b) => (b.achievementScore + b.trackerScore) - (a.achievementScore + a.trackerScore));
  }, [pods, users, todayLogs]);

  const managementLinks = [
    { title: 'Campaigns', href: '/settings/campaigns', icon: Megaphone },
    { title: 'Pods', href: '/settings/pods', icon: ShieldCheck },
    { title: 'Users', href: '/settings/users', icon: Users },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Real-time overview of KPI Quest</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>Latest Competition</CardTitle>
              </div>
              <Link href="/competitions">
                <Button variant="ghost" size="sm" className="h-8">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            {latestCompetition && (
              <CardDescription>
                {latestCompetition.name} ({latestCompetition.startsAt ? format(new Date(latestCompetition.startsAt), 'MMM d') : '?'} - {latestCompetition.endsAt ? format(new Date(latestCompetition.endsAt), 'MMM d, yyyy') : '?'})
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!latestCompetition ? (
              <p className="text-center text-muted-foreground py-8">No competitions</p>
            ) : (
              <div className="space-y-4">
                {latestCompetition.teams?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Team Standings</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {latestCompetition.teams.slice(0, 5).map((team, i) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-bold">
                              {i < 3 ? <Medal className={cn("h-5 w-5", i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400')} /> : i + 1}
                            </TableCell>
                            <TableCell className="font-medium">{team.name}</TableCell>
                            <TableCell className="text-right font-semibold">-</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                <CardTitle>Tracker Leaderboard</CardTitle>
              </div>
              <Link href="/trackers">
                <Button variant="ghost" size="sm" className="h-8">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Today&apos;s top performers - {format(new Date(), 'MMMM d, yyyy')}</CardDescription>
          </CardHeader>
          <CardContent>
            {trackerLeaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tracker logs today</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Pod</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackerLeaderboard.map((agent, i) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-bold">
                        {i < 3 ? <Medal className={cn("h-5 w-5", i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400')} /> : i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">{generateInitials(agent.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{agent.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{agent.podName}</TableCell>
                      <TableCell className="text-right font-semibold">{agent.score.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <CardTitle>Pod Performance</CardTitle>
            </div>
            <CardDescription>Today&apos;s combined metrics by pod</CardDescription>
          </CardHeader>
          <CardContent>
            {podPerformance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Pod</TableHead>
                    <TableHead className="text-center">Agents</TableHead>
                    <TableHead className="text-right">Achievements</TableHead>
                    <TableHead className="text-right">Trackers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {podPerformance.map((pod, i) => (
                    <TableRow key={pod.id}>
                      <TableCell className="font-bold">{i + 1}</TableCell>
                      <TableCell className="font-medium">{pod.name}</TableCell>
                      <TableCell className="text-center">{pod.agentCount}</TableCell>
                      <TableCell className="text-right text-primary">{pod.achievementScore.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500">{pod.trackerScore.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-purple-500" />
                <CardTitle>RPS Game - Today</CardTitle>
              </div>
              <Link href="/mini-games">
                <Button variant="ghost" size="sm" className="h-8">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Rock Paper Scissors stats</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">Play RPS to see standings</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Management</h2>
          <Link href="/settings/users" className="text-sm text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {managementLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card variant="glass" className="glass-card-hover h-full cursor-pointer">
                  <CardContent className="flex items-center p-4">
                    <Icon className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="font-medium">{link.title}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
