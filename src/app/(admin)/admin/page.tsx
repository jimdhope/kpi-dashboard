'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Target, BarChart3, ArrowRight, Medal, Loader2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { AppUser, CompetitionRecord, AppPod } from '@/lib/contracts';

export function ManagementDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [pods, setPods] = useState<AppPod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<any[]>([]);
  const [performerPeriod, setPerformerPeriod] = useState<'day' | 'competition'>('day');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/dashboard/management');
        if (!response.ok) throw new Error('Failed to load management dashboard');
        const data = await response.json();
        setCompetitions(data.competitions || []);
        setPods(data.pods || []);
        setUsers(data.users || []);
        setAchievementLogs(data.achievements || []);

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

  const topPerformers = useMemo(() => {
    if (!latestCompetition) return [];
    const today = new Date().toDateString();
    const agentScores: Record<string, { id: string; name: string; podName: string; score: number }> = {};

    achievementLogs
      .filter(log => log.competitionId === latestCompetition.id)
      .filter(log => performerPeriod === 'competition' || new Date(log.date).toDateString() === today)
      .forEach(log => {
        if (!agentScores[log.agentId]) {
          const user = users.find(candidate => candidate.id === log.agentId);
          const pod = pods.find(candidate => candidate.members.some(member => member.id === log.agentId));
          agentScores[log.agentId] = {
            id: log.agentId,
            name: log.agentName || user?.name || 'Unknown',
            podName: pod?.name || 'Unassigned',
            score: 0,
          };
        }
        agentScores[log.agentId].score += Number(log.points || 0);
      });

    return Object.values(agentScores).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [latestCompetition, achievementLogs, performerPeriod, users, pods]);

  const podPerformance = useMemo(() => {
    const today = new Date().toDateString();
    return pods.map(pod => ({
      id: pod.id,
      name: pod.name,
      achievementScore: achievementLogs
        .filter(log => log.podId === pod.id && new Date(log.date).toDateString() === today)
        .reduce((sum, log) => sum + Number(log.points || 0), 0),
      agentCount: pod.memberCount,
    })).sort((a, b) => b.achievementScore - a.achievementScore);
  }, [pods, achievementLogs]);

  const teamStandings = useMemo(() => {
    if (!latestCompetition) return [];
    const competitionAchievements = achievementLogs.filter(log => log.competitionId === latestCompetition.id);
    return latestCompetition.teams.map(team => ({
      ...team,
      score: competitionAchievements
        .filter(log => ((team as any).agentIds || []).includes(log.agentId))
        .reduce((sum, log) => sum + Number(log.points || 0), 0),
    })).sort((a, b) => b.score - a.score);
  }, [latestCompetition, achievementLogs]);

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

      <div className="flex flex-wrap items-start justify-center gap-5">
        <Card variant="glass" className="order-2 min-w-0 w-full flex-[1_1_22rem] lg:max-w-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                {teamStandings.length > 0 && (
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
                        {teamStandings.slice(0, 5).map((team, i) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-bold">
                              {i < 3 ? <Medal className={cn("h-5 w-5", i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400')} /> : i + 1}
                            </TableCell>
                            <TableCell className="font-medium">{team.name}</TableCell>
                            <TableCell className="text-right font-semibold">{team.score.toLocaleString()}</TableCell>
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

        <Card variant="glass" className="order-3 min-w-0 w-full flex-[1_1_22rem] lg:max-w-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                <CardTitle>Top 10 Performers</CardTitle>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={performerPeriod === 'day' ? 'secondary' : 'ghost'}
                  className="h-7 px-3"
                  onClick={() => setPerformerPeriod('day')}
                >
                  Day
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={performerPeriod === 'competition' ? 'secondary' : 'ghost'}
                  className="h-7 px-3"
                  onClick={() => setPerformerPeriod('competition')}
                >
                  Competition
                </Button>
              </div>
            </div>
            <CardDescription>
              {latestCompetition
                ? `${latestCompetition.name} · ${performerPeriod === 'day' ? format(new Date(), 'MMMM d, yyyy') : 'Full competition'}`
                : 'No active competition'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No performance data for this {performerPeriod === 'day' ? 'day' : 'competition'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Pod</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPerformers.map((agent, i) => (
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

        <Card variant="glass" className="order-1 min-w-0 w-full flex-[1_1_22rem] lg:max-w-xl">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {podPerformance.map((pod, i) => (
                    <TableRow key={pod.id}>
                      <TableCell className="font-bold">{i + 1}</TableCell>
                      <TableCell className="font-medium">{pod.name}</TableCell>
                      <TableCell className="text-center">{pod.agentCount}</TableCell>
                      <TableCell className="text-right text-primary">{pod.achievementScore.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
