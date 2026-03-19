'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, Settings, Megaphone, ShieldCheck, ArrowRight, Medal, Hand, Clock } from "lucide-react";
import { collection, query, orderBy, onSnapshot, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials, cn } from '@/lib/utils';
import { startOfDay, endOfDay, format } from 'date-fns';
import type { AppUser } from '@/services/user';
import { Button } from '@/components/ui/button';

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
  }>;
}

interface DailyAchievementLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  date: Timestamp;
  value: number;
  points?: number;
}

interface Pod {
  id: string;
  name: string;
}

interface TrackerKpi {
  id: string;
  name: string;
  initials: string;
}

interface TrackerLog {
  id?: string;
  agentId: string;
  podId: string;
  trackerKpiId: string;
  date: any;
  value: number;
  loggedAt: any;
}

interface RpsGame {
  userId: string;
  result: 'win' | 'loss' | 'draw';
  timestamp: Timestamp;
}

interface TeamStats {
  id: string;
  name: string;
  emoji?: string;
  wins: number;
  losses: number;
  draws: number;
}

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  
  const [trackerKpis, setTrackerKpis] = useState<TrackerKpi[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>([]);
  
  const [rpsGames, setRpsGames] = useState<RpsGame[]>([]);
  const [teams, setTeams] = useState<Competition['teams']>([]);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const competitionsQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
    unsubscribes.push(onSnapshot(competitionsQuery, (snapshot) => {
      setCompetitions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Competition)));
    }));

    const podsQuery = query(collection(db, 'pods'), orderBy('name'));
    unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
      setPods(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Pod)));
    }));

    const usersQuery = query(collection(db, 'users'), orderBy('name'));
    unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }));

    const logsQuery = query(collection(db, 'dailyAchievements'), orderBy('date', 'desc'));
    unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
      setAchievementLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog)));
      setIsLoading(false);
    }));

    const kpisQuery = query(collection(db, 'trackerKpis'), orderBy('name'));
    unsubscribes.push(onSnapshot(kpisQuery, (snapshot) => {
      setTrackerKpis(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TrackerKpi)));
    }));

    const trackerLogsQuery = query(collection(db, 'trackerLogs'), orderBy('date', 'desc'));
    unsubscribes.push(onSnapshot(trackerLogsQuery, (snapshot) => {
      setTrackerLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TrackerLog)));
    }));

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const rpsQuery = query(
      collection(db, 'rpsGames'),
      where('timestamp', '>=', todayStart),
      where('timestamp', '<=', todayEnd)
    );
    unsubscribes.push(onSnapshot(rpsQuery, (snapshot) => {
      setRpsGames(snapshot.docs.map(d => d.data() as RpsGame));
    }));

    const authUnsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
        }
      }
    });
    unsubscribes.push(authUnsubscribe);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const latestCompetition = useMemo(() => {
    if (competitions.length === 0) return null;
    const now = new Date();
    for (const comp of competitions) {
      const start = comp.startDate?.toDate();
      const end = comp.endDate?.toDate();
      if (start && end && start <= now && end >= now) {
        if (comp.teams) setTeams(comp.teams);
        return comp;
      }
    }
    if (competitions[0]) {
      if (competitions[0].teams) setTeams(competitions[0].teams);
      return competitions[0];
    }
    return null;
  }, [competitions]);

  const todayLogs = useMemo(() => {
    const today = new Date();
    return achievementLogs.filter(log => {
      const logDate = log.date?.toDate?.();
      if (!logDate) return false;
      return logDate.toDateString() === today.toDateString();
    });
  }, [achievementLogs]);

  const competitionPodStandings = useMemo(() => {
    if (!latestCompetition || todayLogs.length === 0) return [];
    const availablePods = pods.filter(p => latestCompetition.podIds?.includes(p.id));
    const podScores: Record<string, { id: string; name: string; score: number }> = {};
    availablePods.forEach(pod => {
      podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 };
    });
    todayLogs.forEach(log => {
      if (podScores[log.podId]) {
        podScores[log.podId].score += log.points || 0;
      }
    });
    return Object.values(podScores).sort((a, b) => b.score - a.score);
  }, [latestCompetition, todayLogs, pods]);

  const competitionTeamStandings = useMemo(() => {
    if (!latestCompetition?.teams || todayLogs.length === 0) return [];
    const teamScores: Record<string, { id: string; name: string; emoji?: string; score: number }> = {};
    latestCompetition.teams.forEach(team => {
      teamScores[team.id] = { id: team.id, name: team.name, emoji: team.emoji, score: 0 };
    });
    todayLogs.forEach(log => {
      const team = latestCompetition.teams?.find(t => t.agentIds?.includes(log.agentId));
      if (team && teamScores[team.id]) {
        teamScores[team.id].score += log.points || 0;
      }
    });
    return Object.values(teamScores).sort((a, b) => b.score - a.score);
  }, [latestCompetition, todayLogs]);

  const todayTrackerLogs = useMemo(() => {
    const today = new Date();
    return trackerLogs.filter(log => {
      const logDate = log.date instanceof Timestamp ? log.date.toDate() : new Date(log.date?.seconds * 1000);
      if (!logDate) return false;
      return logDate.toDateString() === today.toDateString();
    });
  }, [trackerLogs]);

  const trackerLeaderboard = useMemo(() => {
    const agentScores: Record<string, { id: string; name: string; podName: string; score: number }> = {};
    todayTrackerLogs.forEach(log => {
      if (!agentScores[log.agentId]) {
        const user = users.find(u => u.id === log.agentId);
        const pod = pods.find(p => p.id === user?.podId);
        agentScores[log.agentId] = {
          id: log.agentId,
          name: user?.name || 'Unknown',
          podName: pod?.name || 'Unknown',
          score: 0
        };
      }
      agentScores[log.agentId].score += log.value;
    });
    return Object.values(agentScores).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [todayTrackerLogs, users, pods]);

  const podPerformance = useMemo(() => {
    const podStats: Record<string, { id: string; name: string; achievementScore: number; trackerScore: number; agentCount: number }> = {};
    pods.forEach(pod => {
      podStats[pod.id] = { id: pod.id, name: pod.name, achievementScore: 0, trackerScore: 0, agentCount: 0 };
    });
    users.forEach(user => {
      if (user.podId && podStats[user.podId]) {
        podStats[user.podId].agentCount++;
      }
    });
    todayLogs.forEach(log => {
      if (podStats[log.podId]) {
        podStats[log.podId].achievementScore += log.points || 0;
      }
    });
    todayTrackerLogs.forEach(log => {
      const user = users.find(u => u.id === log.agentId);
      if (user?.podId && podStats[user.podId]) {
        podStats[user.podId].trackerScore += log.value;
      }
    });
    return Object.values(podStats).sort((a, b) => (b.achievementScore + b.trackerScore) - (a.achievementScore + a.trackerScore));
  }, [pods, users, todayLogs, todayTrackerLogs]);

  const rpsTeamStandings = useMemo((): TeamStats[] => {
    if (!latestCompetition?.teams || rpsGames.length === 0) return [];
    const stats: Record<string, TeamStats> = {};
    latestCompetition.teams.forEach(team => {
      stats[team.id] = { id: team.id, name: team.name, emoji: team.emoji, wins: 0, losses: 0, draws: 0 };
    });
    rpsGames.forEach(game => {
      const team = latestCompetition.teams?.find(t => t.agentIds?.includes(game.userId));
      if (team && stats[team.id]) {
        if (game.result === 'win') stats[team.id].wins++;
        else if (game.result === 'loss') stats[team.id].losses++;
        else if (game.result === 'draw') stats[team.id].draws++;
      }
    });
    return Object.values(stats).sort((a, b) => b.wins - a.wins);
  }, [latestCompetition, rpsGames]);

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
                {latestCompetition.name} - {latestCompetition.startDate?.toDate && format(latestCompetition.startDate.toDate(), 'MMM d')} - {latestCompetition.endDate?.toDate && format(latestCompetition.endDate.toDate(), 'MMM d, yyyy')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!latestCompetition ? (
              <p className="text-center text-muted-foreground py-8">No active competitions</p>
            ) : (
              <div className="space-y-4">
                {competitionPodStandings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Pod Standings - Today</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Pod</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competitionPodStandings.slice(0, 5).map((pod, i) => (
                          <TableRow key={pod.id}>
                            <TableCell className="font-bold">
                              {i < 3 ? <Medal className={cn("h-5 w-5", i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400')} /> : i + 1}
                            </TableCell>
                            <TableCell className="font-medium">{pod.name}</TableCell>
                            <TableCell className="text-right font-semibold">{pod.score.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {competitionTeamStandings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Team Standings - Today</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competitionTeamStandings.slice(0, 5).map((team, i) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-bold">
                              {i < 3 ? <Medal className={cn("h-5 w-5", i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400')} /> : i + 1}
                            </TableCell>
                            <TableCell className="font-medium">{team.emoji} {team.name}</TableCell>
                            <TableCell className="text-right font-semibold">{team.score.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {competitionPodStandings.length === 0 && competitionTeamStandings.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No achievements logged today</p>
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
            <CardDescription>Rock Paper Scissors team standings</CardDescription>
          </CardHeader>
          <CardContent>
            {rpsTeamStandings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No games played today</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">D</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rpsTeamStandings.map((team, i) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-bold">
                        {i < 3 ? <Medal className={cn("h-5 w-5", i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400')} /> : i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{team.emoji} {team.name}</TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">{team.wins}</TableCell>
                      <TableCell className="text-center text-red-600">{team.losses}</TableCell>
                      <TableCell className="text-center text-gray-500">{team.draws}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Management</h2>
          <Link href="/admin/users" className="text-sm text-primary hover:underline flex items-center gap-1">
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
