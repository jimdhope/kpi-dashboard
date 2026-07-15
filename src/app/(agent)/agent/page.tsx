'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, BarChart3, Gamepad2, Swords, Medal, User as UserIcon, Loader2 } from "lucide-react";
import { cn, generateInitials } from '@/lib/utils';
import { endOfWeek, format, startOfWeek, subDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AppUser } from '@/lib/contracts';

interface KpiDefinition {
  id: string;
  name: string;
  initials: string;
  type: string;
  maxValue?: number;
  sortOrder?: 'asc' | 'desc';
  passFailCriteriaEnabled?: boolean;
  passFailOperator?: 'gte' | 'lte';
  passFailValue?: number;
}

interface KpiLog {
  id: string;
  kpiId: string;
  kpiName: string;
  userId: string | null;
  userName: string | null;
  value: number;
  date: string;
  loggedAt: string;
}

interface Competition {
  id: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  podIds?: string[];
  rules?: Array<{ id: string; title: string; points: number }>;
  teams?: Array<{ id: string; name: string; agentIds?: string[]; emoji?: string }>;
}

interface Pod {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  podId?: string | null;
  email?: string;
  roles: string[];
}

interface Achievement {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName?: string;
  value: number;
  points: number;
  date: string;
  agentName?: string;
}

interface GameLeaderboardEntry {
  userId: string;
  name: string;
  score: number | string;
  rank: number;
}

interface GameLeaderboard {
  id: string;
  name: string;
  scoreLabel: string;
  entries: GameLeaderboardEntry[];
}

const COMPETITION_DASHBOARD_KEY = 'competitionDashboard_selectedCompetitionId';
const COMPETITION_DASHBOARD_POD_KEY = 'competitionDashboard_selectedPodId';

const formatGameTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function AgentDashboard({ initialUser = null }: { initialUser?: AppUser | null }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(true);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [kpiLogs, setKpiLogs] = useState<KpiLog[]>([]);
  const [rpsLeaderboard, setRpsLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [dailyGameLeaderboards, setDailyGameLeaderboards] = useState<GameLeaderboard[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('all');

  // Load the pod selection on mount. Competition selection is loaded as part
  // of the initial dashboard request so only its achievements are transferred.
  useEffect(() => {
    const savedPodId = localStorage.getItem(COMPETITION_DASHBOARD_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const savedCompId = localStorage.getItem(COMPETITION_DASHBOARD_KEY);
        const query = savedCompId ? `?competitionId=${encodeURIComponent(savedCompId)}` : '';
        const response = await fetch(`/api/dashboard/agent${query}`);
        if (!response.ok) throw new Error('Failed to load dashboard data');
        const data = await response.json();

        setCurrentUser(data.user || initialUser);
        const comps = data.competitions || [];
        setCompetitions(comps);
        setPods(data.pods || []);
        setUsers(data.users || []);
        setKpis(data.kpis || []);
        setKpiLogs(data.kpiLogs || []);
        setRpsLeaderboard(data.rpsLeaderboard || []);
        setAchievements(data.achievements || []);
          
        const selected = comps.find((c: Competition) => c.id === data.achievementCompetitionId)
          ?? comps[0];
        if (selected) setSelectedCompetitionId(selected.id);

        const names: Record<string, string> = {
          'higher-lower:default': 'Higher or Lower',
          'daily-word:default': 'Daily Word',
          'sudoku:easy': 'Sudoku · Easy',
          'sudoku:medium': 'Sudoku · Medium',
          'sudoku:hard': 'Sudoku · Hard',
        };
        setDailyGameLeaderboards((data.dailyGames || []).map((game: any) => ({
          id: `${game.gameKey}:${game.variant}`,
          name: names[`${game.gameKey}:${game.variant}`] || game.gameKey,
          scoreLabel: game.gameKey === 'higher-lower' ? 'Streak' : game.gameKey === 'daily-word' ? 'Guesses' : 'Time',
          entries: (game.leaderboard || []).map((entry: any) => ({
            ...entry,
            score: game.gameKey === 'daily-word'
              ? entry.guesses
              : game.gameKey === 'sudoku' ? formatGameTime(entry.score) : entry.score,
          })),
        })));
      } catch (err) {
        console.error('Error initializing dashboard:', err);
      }
      setIsLoading(false);
    }
    init();
  }, []);

  // Persist competition selection
  useEffect(() => {
    if (selectedCompetitionId) {
      localStorage.setItem(COMPETITION_DASHBOARD_KEY, selectedCompetitionId);
    }
  }, [selectedCompetitionId]);

  // Persist pod selection
  useEffect(() => {
    if (selectedPodId === 'all') {
      localStorage.removeItem(COMPETITION_DASHBOARD_POD_KEY);
    } else {
      localStorage.setItem(COMPETITION_DASHBOARD_POD_KEY, selectedPodId);
    }
  }, [selectedPodId]);

  const selectedCompetition = competitions.find((c) => c.id === selectedCompetitionId);

  // Use database rules first, fallback to draftData rules (for legacy competitions)
  const competitionRules = useMemo(() => {
    if (!selectedCompetition) return [];
    const dbRules = selectedCompetition.rules || [];
    const draftDataRules = (selectedCompetition as any).draftData?.rules || [];
    return dbRules.length > 0 ? dbRules : draftDataRules;
  }, [selectedCompetition]);

  // Use database teams first, fallback to draftData teams
  const competitionTeams = useMemo(() => {
    if (!selectedCompetition) return [];
    const dbTeams = selectedCompetition.teams || [];
    const draftDataTeams = (selectedCompetition as any).draftData?.teams || [];
    return dbTeams.length > 0 ? dbTeams : draftDataTeams;
  }, [selectedCompetition]);

  const availablePods = useMemo(() => {
    if (!selectedCompetition) return [];
    return pods.filter((p) => selectedCompetition.podIds?.includes(p.id));
  }, [selectedCompetition, pods]);

  const filteredPods = selectedPodId === 'all' ? availablePods : availablePods.filter((p) => p.id === selectedPodId);
  const filteredPodIds = filteredPods.map((p) => p.id);

  const competitionAchievements = useMemo(() => {
    if (!selectedCompetitionId) return [];
    return achievements.filter((a) => a.competitionId === selectedCompetitionId);
  }, [achievements, selectedCompetitionId]);

  const achievementSummary = useMemo(() => {
    if (!competitionRules || competitionAchievements.length === 0) return [];

    return competitionRules.map((rule: any) => {
      const ruleLogs = competitionAchievements.filter((log: any) => {
        const matchesRule = log.ruleId === rule.id || log.ruleName === rule.title;
        const matchesPod = filteredPodIds.length === 0 || filteredPodIds.includes(log.podId);
        return matchesRule && matchesPod;
      });

      const totalValue = ruleLogs.reduce((sum: number, log: any) => sum + log.value, 0);
      const totalPoints = ruleLogs.reduce((sum: number, log: any) => sum + log.points, 0);

      return { rule, totalValue, totalPoints };
    });
  }, [competitionRules, competitionAchievements, filteredPodIds]);

  const podStandings = useMemo(() => {
    if (competitionAchievements.length === 0) return [];

    const podScores: Record<string, { id: string; name: string; score: number }> = {};
    const availablePodIds = new Set(availablePods.map(p => p.id));

    // Initialize pods from competition
    availablePods.forEach((pod) => {
      podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 };
    });

    // Track achievements with unknown pods
    let unknownPodScore = 0;

    competitionAchievements.forEach((log) => {
      if (availablePodIds.has(log.podId) && podScores[log.podId]) {
        podScores[log.podId].score += log.points;
      } else {
        // Fallback: group achievements with missing podIds into "Unknown Pod"
        unknownPodScore += log.points;
      }
    });

    const standings = Object.values(podScores).sort((a, b) => b.score - a.score);
    
    // Add "Unknown Pod" if there were achievements with missing podIds
    if (unknownPodScore > 0) {
      standings.push({ id: 'unknown', name: 'Unknown Pod', score: unknownPodScore });
    }

    return standings;
  }, [competitionAchievements, availablePods]);

  const teamStandings = useMemo(() => {
    const teams = competitionTeams;
    const teamScores: Record<string, { id: string; name: string; score: number; emoji?: string; memberNames: string }> = {};

    // Initialize teams
    teams.forEach((team: any) => {
      const memberNames = (team.agentIds || [])
        .map((agentId: string) => {
          const user = users.find((u: any) => u.id === agentId);
          return user ? user.name.split(' ')[0] : null;
        })
        .filter(Boolean)
        .join(', ');
      teamScores[team.id] = { id: team.id, name: team.name, emoji: team.emoji, score: 0, memberNames };
    });

    // Calculate scores from achievements by linking agents to teams
    const unassignedScore = { id: 'unassigned', name: 'Unassigned', score: 0, memberNames: '' };
    competitionAchievements.forEach((log: any) => {
      const teamWithAgent = teams.find((team: any) => 
        team.agentIds && team.agentIds.includes(log.agentId)
      );
      if (teamWithAgent && teamScores[teamWithAgent.id]) {
        teamScores[teamWithAgent.id].score += log.points;
      } else {
        // Agent not on any team - add to unassigned
        unassignedScore.score += log.points;
      }
    });

    const standings = Object.values(teamScores).sort((a, b) => b.score - a.score);
     
    // Add "Unassigned" if there were agents not on any team
    if (unassignedScore.score > 0) {
      standings.push(unassignedScore);
    }

    return standings;
  }, [competitionTeams, competitionAchievements, users]);

  const agentStandings = useMemo(() => {
    const agentScores: Record<string, { id: string; name: string; score: number }> = {};

    competitionAchievements.forEach((log) => {
      const matchesPod = filteredPodIds.length === 0 || filteredPodIds.includes(log.podId);
      if (!matchesPod) return;

      if (!agentScores[log.agentId]) {
        const user = users.find((u) => u.id === log.agentId);
        agentScores[log.agentId] = {
          id: log.agentId,
          name: log.agentName || user?.name || 'Unknown',
          score: 0,
        };
      }
      agentScores[log.agentId].score += log.points;
    });

    return Object.values(agentScores).sort((a, b) => b.score - a.score);
  }, [competitionAchievements, users, filteredPodIds]);

  const handleCompetitionChange = async (value: string) => {
    setSelectedCompetitionId(value);
    setAchievements([]);
    // Reset pod filter when competition changes
    setSelectedPodId('all');
    try {
      const response = await fetch(`/api/achievements?competitionId=${encodeURIComponent(value)}&limit=1000`);
      if (!response.ok) throw new Error('Failed to load competition standings');
      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (error) {
      console.error('Error loading competition achievements:', error);
    }
  };

  const handlePodChange = (value: string) => {
    setSelectedPodId(value);
  };

  const gameLeaderboards = useMemo((): GameLeaderboard[] => [{
    id: 'rock-paper-scissors',
    name: 'Rock Paper Scissors',
    scoreLabel: 'Wins',
    entries: rpsLeaderboard,
  }, ...dailyGameLeaderboards], [rpsLeaderboard, dailyGameLeaderboards]);

  const agentPerformanceData = useMemo(() => {
    const weekStartsOn = 4 as const;
    if (kpis.length === 0 || kpiLogs.length === 0) {
      return { kpis: [] as KpiDefinition[], weekHeaders: [] as string[], weeklyScores: {} as Record<string, Record<string, { value: number; count: number }>>, kpiWeekHeaders: {} as Record<string, string[]> };
    }

    const maxDateByKpi: Record<string, Date> = {};
    kpiLogs.forEach((log) => {
      const date = new Date(log.date);
      if (!maxDateByKpi[log.kpiId] || date > maxDateByKpi[log.kpiId]) maxDateByKpi[log.kpiId] = date;
    });

    const filteredLogs = kpiLogs.filter((log) => {
      const maxDate = maxDateByKpi[log.kpiId];
      const date = new Date(log.date);
      return maxDate && date >= subDays(maxDate, 42) && date <= maxDate;
    });
    const activeKpiIds = new Set(filteredLogs.map((log) => log.kpiId));
    const activeKpis = kpis
      .filter((kpi) => activeKpiIds.has(kpi.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const weeklyScores: Record<string, Record<string, { value: number; count: number }>> = {};
    const weeks = new Set<string>();

    filteredLogs.forEach((log) => {
      const week = format(startOfWeek(new Date(log.date), { weekStartsOn }), 'MMM dd, yyyy');
      weeks.add(week);
      weeklyScores[week] ||= {};
      weeklyScores[week][log.kpiId] ||= { value: 0, count: 0 };
      weeklyScores[week][log.kpiId].value += log.value;
      weeklyScores[week][log.kpiId].count += 1;
    });

    const availableWeeks = Array.from(weeks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const maxWeekDate = new Date(availableWeeks[availableWeeks.length - 1]);
    const weekHeaders = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(maxWeekDate);
      date.setDate(date.getDate() - (6 - index) * 7);
      return format(date, 'MMM dd, yyyy');
    });
    const kpiWeekHeaders: Record<string, string[]> = {};
    activeKpis.forEach((kpi) => {
      kpiWeekHeaders[kpi.id] = Array.from(new Set(
        filteredLogs
          .filter((log) => log.kpiId === kpi.id)
          .map((log) => format(startOfWeek(new Date(log.date), { weekStartsOn }), 'MMM dd, yyyy'))
      )).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).slice(-6);
    });

    return { kpis: activeKpis, weekHeaders, weeklyScores, kpiWeekHeaders };
  }, [kpis, kpiLogs]);

  if (isLoading || !currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  const getCellClass = (value: number | undefined, kpi: KpiDefinition): string => {
    if (value === undefined) return '';
    if (!kpi.passFailCriteriaEnabled || kpi.passFailValue === undefined || kpi.passFailValue === null) return '';
    const passed = kpi.passFailOperator === 'gte'
      ? value >= kpi.passFailValue
      : value <= kpi.passFailValue;
    return passed ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {currentUser.name?.split(' ')[0] || 'Agent'}!</h1>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">

        {/* Competition Card */}
        <Link href="/agent/competitions">
          <Card variant="glass" className="glass-card-hover cursor-pointer overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">Competitions</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Select value={selectedCompetitionId} onValueChange={handleCompetitionChange}>
                      <SelectTrigger className="w-[180px] md:w-[220px] glass-input">
                        <SelectValue placeholder="Select competition" />
                      </SelectTrigger>
                      <SelectContent>
                        {competitions.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedPodId} onValueChange={handlePodChange}>
                      <SelectTrigger className="w-[120px] md:w-[150px] glass-input">
                        <SelectValue placeholder="All Pods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Pods</SelectItem>
                        {availablePods.map((pod) => (
                          <SelectItem key={pod.id} value={pod.id}>
                            {pod.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {!selectedCompetitionId ? (
                <p className="text-sm text-muted-foreground text-center py-4">No competitions available</p>
              ) : competitionAchievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No achievements logged yet</p>
              ) : (
                <div className="space-y-4">
                  {/* Pod Standings */}
                  {availablePods.length > 1 && (
                    <div className="[&>div]:overflow-visible">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Pod Standings</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Pod</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {podStandings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-xs">No pods in this competition</TableCell>
                            </TableRow>
                          ) : (
                            podStandings.map((pod, index) => {
                              const isCurrentUserPod = currentUser?.podIds?.includes(pod.id) ?? false;
                              return (
                              <TableRow key={pod.id} className={isCurrentUserPod ? 'bg-primary/10' : ''}>
                                <TableCell className="font-bold">
                                  {index < 3 ? (
                                    <Medal className={`h-5 w-5 ${
                                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                    }`} />
                                  ) : (
                                    index + 1
                                  )}
                                </TableCell>
                                <TableCell className={`font-medium ${isCurrentUserPod ? 'text-primary font-semibold' : ''}`}>{pod.name}</TableCell>
                                <TableCell className={`text-right font-bold ${isCurrentUserPod ? 'text-primary' : ''}`}>{pod.score.toLocaleString()}</TableCell>
                              </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Team Standings */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Team Standings</p>
                    <div className="[&>div]:overflow-visible">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamStandings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-xs">No teams configured</TableCell>
                            </TableRow>
                          ) : (
                            teamStandings.map((team, index) => {
                              const competitionTeam = competitionTeams.find((candidate: any) => candidate.id === team.id);
                              const isCurrentUserTeam = competitionTeam?.agentIds?.includes(currentUser?.id) ?? false;
                              return (
                              <TableRow key={team.id} className={isCurrentUserTeam ? 'bg-primary/10' : ''}>
                                <TableCell className="font-bold">
                                  {index < 3 ? (
                                    <Medal className={`h-5 w-5 ${
                                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                    }`} />
                                  ) : (
                                    index + 1
                                  )}
                                </TableCell>
                                <TableCell className={`font-medium ${isCurrentUserTeam ? 'text-primary font-semibold' : ''}`}>
                                  {team.name}
                                  {team.memberNames && (
                                    <span className="text-muted-foreground text-xs ml-2" title={team.memberNames}>
                                      ({team.memberNames.length > 25 ? team.memberNames.substring(0, 25) + '...' : team.memberNames})
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${isCurrentUserTeam ? 'text-primary' : ''}`}>{team.score.toLocaleString()}</TableCell>
                              </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Agent Standings */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Agent Standings</p>
                    <div className="[&>div]:overflow-visible">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agentStandings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-xs">No achievements logged yet</TableCell>
                            </TableRow>
                          ) : (
                            agentStandings.slice(0, 20).map((agent, index) => {
                              const isCurrentUser = agent.id === currentUser?.id;
                              return (
                                <TableRow key={agent.id} className={isCurrentUser ? 'bg-primary/10' : ''}>
                                  <TableCell className="font-bold">
                                    {index < 3 ? (
                                      <Medal className={`h-5 w-5 ${
                                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                      }`} />
                                    ) : (
                                      index + 1
                                    )}
                                  </TableCell>
                                  <TableCell className={`font-medium ${isCurrentUser ? 'text-primary font-semibold' : ''}`}>
                                    {isCurrentUser ? 'You' : agent.name}
                                  </TableCell>
                                  <TableCell className={`text-right font-bold ${isCurrentUser ? 'text-primary' : ''}`}>
                                    {agent.score.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Performance Card */}
        <Link href="/agent/performance">
          <Card variant="glass" className="glass-card-hover cursor-pointer overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Performance</CardTitle>
                  <CardDescription>6-week KPI breakdown</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-0">
              {agentPerformanceData.kpis.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No KPI data available</p>
              ) : (
                <div>
                  <div className="bg-gray-200 dark:bg-gray-700 py-3 px-4 border-y text-base font-semibold flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-gray-800 dark:text-gray-100">{currentUser.name}</span>
                  </div>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600">
                        <TableHead className="w-[140px] text-xs font-bold uppercase text-gray-700 dark:text-gray-200">KPI</TableHead>
                        {agentPerformanceData.weekHeaders.map((week) => (
                          <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-gray-700 dark:text-gray-200">
                            {format(endOfWeek(new Date(week), { weekStartsOn: 4 }), 'dd/MM')}
                          </TableHead>
                        ))}
                        <TableHead className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-primary border-l-2 border-primary">AVG</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentPerformanceData.kpis.map((kpi, index) => (
                        <TableRow key={kpi.id} className={`h-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${index % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                          <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-gray-100/30 dark:bg-gray-700/30 text-gray-800 dark:text-gray-200 break-words max-w-[140px]">
                            <div className="flex items-center gap-1">
                              <span className="break-words">{kpi.name}</span>
                              <span className={cn('text-[9px] font-medium shrink-0', kpi.sortOrder === 'asc' ? 'text-blue-500' : 'text-green-500')}>
                                {kpi.sortOrder === 'asc' ? '↓' : '↑'}
                              </span>
                              {kpi.type === 'scoreOutOf' && kpi.maxValue !== undefined && (
                                <span className="text-[9px] text-muted-foreground shrink-0">/{kpi.maxValue}</span>
                              )}
                              {kpi.type !== 'scoreOutOf' && kpi.passFailCriteriaEnabled && kpi.passFailValue !== undefined && (
                                <span className="text-[9px] text-muted-foreground shrink-0">/{kpi.passFailValue}{kpi.type === 'percentage' ? '%' : ''}</span>
                              )}
                            </div>
                          </TableCell>
                          {agentPerformanceData.weekHeaders.map((week) => {
                            const weeklyData = agentPerformanceData.weeklyScores[week]?.[kpi.id];
                            const score = weeklyData
                              ? (kpi.type === 'percentage' ? weeklyData.value / weeklyData.count : weeklyData.value)
                              : undefined;
                            return (
                              <TableCell key={week} className={cn('text-center text-[11px] py-1 px-1 border-l bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 tabular-nums font-medium', getCellClass(score, kpi))}>
                                {score !== undefined ? (kpi.type === 'percentage' ? `${score.toFixed(0)}%` : score.toLocaleString()) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center text-[11px] py-1 px-1 border-l-2 border-primary font-bold tabular-nums bg-primary/5 text-primary">
                            {(() => {
                              const averageWeeks = agentPerformanceData.kpiWeekHeaders[kpi.id] || [];
                              const total = averageWeeks.reduce((sum, week) => {
                                const data = agentPerformanceData.weeklyScores[week]?.[kpi.id];
                                if (!data) return sum;
                                return sum + ((kpi.type === 'percentage' || kpi.type === 'scoreOutOf') ? data.value / data.count : data.value);
                              }, 0);
                              const average = (kpi.type === 'percentage' || kpi.type === 'scoreOutOf') ? total / 6 : total;
                              return kpi.type === 'percentage' ? `${average.toFixed(1)}%` : average.toLocaleString(undefined, { maximumFractionDigits: 2 });
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Mini Games Card */}
        <Link href="/mini-games">
          <Card variant="glass" className="glass-card-hover cursor-pointer overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Gamepad2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Mini Games</CardTitle>
                  <CardDescription>Top 10 scores for each game</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {gameLeaderboards.every((game) => game.entries.length === 0) ? (
                <div className="text-center py-4">
                  <Swords className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs text-muted-foreground">Play a mini game to see the leaderboards</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {gameLeaderboards.map((game) => game.entries.length > 0 && (
                    <div key={game.id}>
                      <div className="mb-2 flex items-center justify-between border-b pb-2">
                        <span className="text-sm font-semibold">{game.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{game.scoreLabel}</span>
                      </div>
                      <div className="space-y-0.5">
                        {game.entries.slice(0, 10).map((entry) => {
                          const isCurrentUser = entry.userId === currentUser.id;
                          return (
                            <div key={entry.userId} className={`flex items-center gap-2 p-1.5 rounded transition-colors ${isCurrentUser ? 'bg-purple-500/20 ring-1 ring-purple-500/50' : 'hover:bg-muted/30'}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                                entry.rank === 1 ? 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50' :
                                entry.rank === 2 ? 'bg-gray-400/30 text-gray-300 border-gray-400/50' :
                                entry.rank === 3 ? 'bg-orange-400/30 text-orange-400 border-orange-400/50' :
                                'bg-muted/30 text-muted-foreground border-muted'
                              }`}>
                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                              </div>
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[8px]">{generateInitials(entry.name)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs truncate block ${isCurrentUser ? 'font-semibold text-purple-400' : 'font-medium'}`}>
                                  {isCurrentUser ? 'You' : entry.name}
                                </span>
                              </div>
                              <span className={`text-xs font-bold tabular-nums ${isCurrentUser ? 'text-purple-400' : ''}`}>{entry.score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function LegacyAgentDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard?view=agent');
  }, [router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
