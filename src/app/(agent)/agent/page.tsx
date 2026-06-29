'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Star, TrendingUp, Award, Zap, Swords, Flame, Crown, Medal, Users } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, subWeeks, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import type { AppUser, CompetitionRecord, PerformanceLogRecord } from '@/lib/contracts';

interface DailyAchievementLog {
  id: string;
  agentId: string;
  competitionId: string;
  ruleId: string;
  date: string;
  points: number;
  value: number;
}

interface TrackerLog {
  id: string;
  agentId: string;
  trackerKpiId: string;
  date: string;
  value: number;
}

interface TrackerKpi {
  id: string;
  name: string;
  initials: string;
}

interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: string;
  passFailCriteriaEnabled?: boolean;
  passFailOperator?: 'gte' | 'lte';
  passFailValue?: number;
}

interface WeekHeader {
  label: string;
  start: Date;
  end: Date;
}

const LEADERBOARD_COMPETITION_KEY = 'agentDashboard_selectedCompetitionId';

export default function AgentDashboard() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>([]);
  const [trackerKpis, setTrackerKpis] = useState<TrackerKpi[]>([]);
  const [performanceLogs, setPerformanceLogs] = useState<PerformanceLogRecord[]>([]);
  const [additionalKpis, setAdditionalKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rpsLeaderboard, setRpsLeaderboard] = useState<{userId: string; name: string; wins: number}[]>([]);
  const [gamificationProfile, setGamificationProfile] = useState<any>(null);

  // Fetch user session
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      }
      setIsLoading(false);
    }
    fetchSession();
  }, []);

  // Fetch competitions
  useEffect(() => {
    async function fetchCompetitions() {
      try {
        const res = await fetch('/api/competitions');
        if (res.ok) {
          const data = await res.json();
          setCompetitions(data.competitions || []);
          
          if (data.competitions?.length > 0) {
            const now = new Date();
            const currentComp = data.competitions.find((comp: any) => {
              const start = comp.startsAt ? new Date(comp.startsAt) : null;
              const end = comp.endsAt ? new Date(comp.endsAt) : null;
              return start && end && now >= start && now <= end;
            });
            
            if (currentComp) {
              setSelectedCompetitionId(currentComp.id);
              localStorage.setItem(LEADERBOARD_COMPETITION_KEY, currentComp.id);
            } else {
              const savedCompId = localStorage.getItem(LEADERBOARD_COMPETITION_KEY);
              if (savedCompId && data.competitions.some((c: any) => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
              } else {
                setSelectedCompetitionId(data.competitions[0].id);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching competitions:', err);
      }
    }
    fetchCompetitions();
  }, []);

  // Fetch all agents for leaderboard names
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.users || []);
        }
      } catch (err) {
        console.error('Error fetching agents:', err);
      }
    }
    fetchAgents();
  }, []);

  // Fetch achievement logs
  useEffect(() => {
    async function fetchAchievements() {
      if (!selectedCompetitionId) {
        setAchievementLogs([]);
        return;
      }
      try {
        const res = await fetch(`/api/competitions/${selectedCompetitionId}/achievements`);
        if (res.ok) {
          const data = await res.json();
          setAchievementLogs(data.achievements || []);
        }
      } catch (err) {
        console.error('Error fetching achievements:', err);
      }
    }
    fetchAchievements();
  }, [selectedCompetitionId]);

  // Fetch tracker KPIs
  useEffect(() => {
    async function fetchTrackerKpis() {
      try {
        const res = await fetch('/api/trackers');
        if (res.ok) {
          const data = await res.json();
          setTrackerKpis(data.trackers || []);
        }
      } catch (err) {
        console.error('Error fetching tracker KPIs:', err);
      }
    }
    fetchTrackerKpis();
  }, []);

  // Fetch performance logs (all time)
  useEffect(() => {
    async function fetchPerformanceLogs() {
      if (!currentUser?.id) {
        setPerformanceLogs([]);
        return;
      }
      try {
        const res = await fetch('/api/performance/logs');
        if (res.ok) {
          const data = await res.json();
          const userLogs = (data.logs || []).filter((log: any) => log.agentId === currentUser.id);
          setPerformanceLogs(userLogs);
        }
      } catch (err) {
        console.error('Error fetching performance logs:', err);
      }
    }
    fetchPerformanceLogs();
  }, [currentUser?.id]);

  // Fetch RPS leaderboard
  useEffect(() => {
    // RPS leaderboard would come from API if implemented
    setRpsLeaderboard([]);
  }, []);

  // Fetch gamification profile
  useEffect(() => {
    async function fetchGamification() {
      try {
        const res = await fetch('/api/gamification/profile');
        if (res.ok) {
          const data = await res.json();
          setGamificationProfile(data.profile);
        }
      } catch (err) {
        console.error('Error fetching gamification profile:', err);
      }
    }
    fetchGamification();
  }, []);

  // Calculate competition stats
  const competitionStats = useMemo(() => {
    if (!selectedCompetitionId || competitions.length === 0) {
      return { 
        competitionName: '', 
        teamLeaderboard: [], 
        agentLeaderboard: [],
        userRank: '-',
        userScore: 0 
      };
    }

    const competition = competitions.find(c => c.id === selectedCompetitionId);
    if (!competition) {
      return { 
        competitionName: '', 
        teamLeaderboard: [], 
        agentLeaderboard: [],
        userRank: '-',
        userScore: 0 
      };
    }

    // Calculate team scores
    const teamScores: Record<string, number> = {};
    competition.teams?.forEach(team => {
      teamScores[team.id] = 0;
    });

    achievementLogs.forEach(log => {
      const team = competition.teams?.find(t => {
        // This is simplified - real implementation would need user-to-team mapping
        return true;
      });
      if (team) {
        teamScores[team.id] = (teamScores[team.id] || 0) + (log.points || 0);
      }
    });

    const teamLeaderboard = competition.teams
      ?.map(team => ({
        id: team.id,
        name: team.name,
        score: teamScores[team.id] || 0,
      }))
      .sort((a, b) => b.score - a.score) || [];

    // Calculate agent scores
    const agentScores: Record<string, number> = {};
    achievementLogs.forEach(log => {
      if (!agentScores[log.agentId]) {
        agentScores[log.agentId] = 0;
      }
      agentScores[log.agentId] += log.points || 0;
    });

    const uniqueAgents = [...new Set(achievementLogs.map(log => log.agentId))];
    
    const agentLeaderboard = uniqueAgents
      .map(agentId => {
        const agent = agents.find(a => a.id === agentId);
        return {
          agentId,
          name: agent?.name || 'Unknown',
          score: agentScores[agentId] || 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    let userRank = '-';
    let userScore = 0;
    if (currentUser?.id) {
      const userIndex = agentLeaderboard.findIndex(a => a.agentId === currentUser.id);
      if (userIndex !== -1) {
        userRank = String(userIndex + 1);
        userScore = agentLeaderboard[userIndex].score;
      }
    }

    return { 
      competitionName: competition.name,
      teamLeaderboard,
      agentLeaderboard,
      userRank,
      userScore,
    };
  }, [selectedCompetitionId, competitions, achievementLogs, agents, currentUser?.id]);

  // Calculate tracker stats
  const trackerStats = useMemo(() => {
    const today = startOfDay(new Date()).toISOString();
    const todayLogs = trackerLogs.filter(log => {
      const logDate = new Date(log.date).toISOString().split('T')[0];
      const todayStr = today.split('T')[0];
      return logDate === todayStr;
    });
    
    const agentCounts: Record<string, number> = {};
    todayLogs
      .filter(log => log.agentId === currentUser?.id)
      .forEach(log => {
        if (!agentCounts[log.trackerKpiId]) {
          agentCounts[log.trackerKpiId] = 0;
        }
        agentCounts[log.trackerKpiId] += log.value || 0;
      });

    const agentTrackerData = trackerKpis.map(kpi => ({
      ...kpi,
      count: agentCounts[kpi.id] || 0,
    })).sort((a, b) => b.count - a.count);

    // Calculate leaderboard (all agents)
    const allAgentCounts: Record<string, Record<string, number>> = {};
    todayLogs.forEach(log => {
      if (!allAgentCounts[log.agentId]) {
        allAgentCounts[log.agentId] = {};
      }
      if (!allAgentCounts[log.agentId][log.trackerKpiId]) {
        allAgentCounts[log.agentId][log.trackerKpiId] = 0;
      }
      allAgentCounts[log.agentId][log.trackerKpiId] += log.value || 0;
    });

    const leaderboard = Object.entries(allAgentCounts)
      .map(([agentId, counts]) => {
        const agent = agents.find(a => a.id === agentId);
        const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
        return {
          agentId,
          name: agent?.name || 'Unknown',
          total,
          counts,
        };
      })
      .sort((a, b) => b.total - a.total);

    let userRank = '-';
    if (currentUser?.id) {
      const userIndex = leaderboard.findIndex(a => a.agentId === currentUser.id);
      if (userIndex !== -1) {
        userRank = String(userIndex + 1);
      }
    }

    return { agentTrackerData, leaderboard, userRank };
  }, [trackerLogs, trackerKpis, agents, currentUser?.id]);

  // Generate 6 weeks of data
  const weekHeaders = useMemo((): WeekHeader[] => {
    const now = new Date();
    const weeks: WeekHeader[] = [];
    
    let currentWednesday = startOfWeek(now, { weekStartsOn: 3 });
    const dayOfWeek = now.getDay();
    const daysSinceWednesday = dayOfWeek === 3 ? 0 : (dayOfWeek + 4) % 7;
    currentWednesday = new Date(now);
    currentWednesday.setDate(now.getDate() - daysSinceWednesday);
    currentWednesday.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 6; i++) {
      const weekStart = new Date(currentWednesday);
      weekStart.setDate(currentWednesday.getDate() - (i * 7));
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekStart.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);
      
      weeks.unshift({
        label: format(weekStart, 'MMM d'),
        start: weekStart,
        end: weekEndDate,
      });
    }
    
    return weeks;
  }, []);

  // Calculate performance stats
  const performanceStats = useMemo(() => {
    const weekPoints = performanceLogs.reduce((sum, log) => sum + (log.value || 0), 0);
    
    const kpiBreakdown = additionalKpis.map(kpi => {
      const weeklyValues: Record<string, number> = {};
      
      weekHeaders.forEach(week => {
        const weekLogs = performanceLogs.filter(log => {
          if (log.trackerKpiId !== kpi.id) return false;
          const logDate = new Date(log.loggedAt);
          return logDate >= week.start && logDate <= week.end;
        });
        
        weeklyValues[week.label] = weekLogs.reduce((sum, log) => sum + (log.value || 0), 0);
      });

      return {
        kpi,
        weeklyValues,
        total: Object.values(weeklyValues).reduce((sum, val) => sum + val, 0),
      };
    }).sort((a, b) => b.total - a.total);
    
    return { weekPoints, kpiBreakdown };
  }, [performanceLogs, additionalKpis, weekHeaders]);

  if (isLoading || !currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {currentUser.name?.split(' ')[0] || 'Agent'}!</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Competitions Card */}
        <Link href="/competitions">
          <Card variant="glass" className="glass-card-hover h-full cursor-pointer overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Competitions</CardTitle>
                  <CardDescription className="line-clamp-1">{competitionStats.competitionName || 'No active competition'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Team Standings</p>
                  <div className="space-y-1">
                    {competitionStats.teamLeaderboard.slice(0, 5).map((team, index) => (
                      <div 
                        key={team.id} 
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          index === 0 ? 'bg-yellow-500/10' : index === 1 ? 'bg-gray-400/10' : index === 2 ? 'bg-orange-400/10' : 'bg-glass/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                            index === 1 ? 'bg-gray-400/30 text-gray-300' :
                            index === 2 ? 'bg-orange-400/30 text-orange-400' :
                            'bg-glass text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium">{team.name}</span>
                        </div>
                        <span className="text-sm font-bold">{team.score.toLocaleString()}</span>
                      </div>
                    ))}
                    {competitionStats.teamLeaderboard.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No teams</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Agent Leaderboard</p>
                  <div className="space-y-1">
                    {competitionStats.agentLeaderboard.slice(0, 3).map((agent, index) => {
                      const isCurrentUser = agent.agentId === currentUser?.id;
                      const displayName = isCurrentUser ? 'You' : agent.name.split(' ')[0];
                      return (
                        <div 
                          key={agent.agentId} 
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            isCurrentUser ? 'bg-primary/20 ring-1 ring-primary/50' : 'bg-glass/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                              index === 1 ? 'bg-gray-400/30 text-gray-300' :
                              index === 2 ? 'bg-orange-400/30 text-orange-400' :
                              'bg-glass text-muted-foreground'
                            }`}>
                              {index + 1}
                            </span>
                            <span className={`text-sm truncate max-w-[100px] ${isCurrentUser ? 'font-medium text-primary' : ''}`}>
                              {displayName}
                            </span>
                          </div>
                          <span className={`text-sm font-bold ${isCurrentUser ? 'text-primary' : ''}`}>
                            {agent.score.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                    {competitionStats.userRank !== '-' && parseInt(competitionStats.userRank) > 3 && (
                      <>
                        <div className="flex items-center center py-1">
                          <span className="text-xs text-muted-foreground">...</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-primary/20 ring-1 ring-primary/50">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-primary/30 text-primary">
                              {competitionStats.userRank}
                            </span>
                            <span className="text-sm font-medium text-primary">You</span>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {competitionStats.userScore.toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                    {competitionStats.agentLeaderboard.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No agents</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Trackers Card */}
        <Link href="/trackers/log">
          <Card variant="glass" className="glass-card-hover h-full cursor-pointer overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Trackers</CardTitle>
                  <CardDescription>Rolling tracker performance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Your Trackers</p>
                  <div className="space-y-1">
                    {trackerStats.agentTrackerData.slice(0, 5).map(kpi => (
                      <div key={kpi.id} className="flex items-center justify-between p-2 rounded-lg bg-glass/20">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-green-500">{kpi.initials}</span>
                          </div>
                          <span className="text-sm truncate max-w-[80px]">{kpi.name}</span>
                        </div>
                        <span className="text-sm font-bold text-green-500">{kpi.count}</span>
                      </div>
                    ))}
                    {trackerStats.agentTrackerData.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No data</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Leaderboard</p>
                  <div className="space-y-1">
                    {trackerStats.leaderboard.slice(0, 5).map((agent, index) => {
                      const isCurrentUser = agent.agentId === currentUser?.id;
                      return (
                        <div 
                          key={agent.agentId} 
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            isCurrentUser ? 'bg-primary/20 ring-1 ring-primary/50' : 'bg-glass/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                              index === 1 ? 'bg-gray-400/30 text-gray-300' :
                              index === 2 ? 'bg-orange-400/30 text-orange-400' :
                              'bg-glass text-muted-foreground'
                            }`}>
                              {index + 1}
                            </span>
                            <span className={`text-sm truncate max-w-[80px] ${isCurrentUser ? 'text-primary font-medium' : ''}`}>
                              {isCurrentUser ? 'You' : agent.name.split(' ')[0]}
                            </span>
                          </div>
                          <span className={`text-sm font-bold ${isCurrentUser ? 'text-primary' : ''}`}>
                            {agent.total}
                          </span>
                        </div>
                      );
                    })}
                    {trackerStats.leaderboard.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No data</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Performance Card */}
        <Link href="/performance">
          <Card variant="glass" className="glass-card-hover h-full cursor-pointer overflow-hidden">
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
            <CardContent className="overflow-hidden">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-glass-border/30">
                      <th className="text-left py-1 px-1 font-medium text-muted-foreground">KPI</th>
                      {weekHeaders.slice(-6).map(week => (
                        <th key={week.label} className="text-center py-1 px-1 font-medium text-muted-foreground min-w-[32px]">
                          {format(new Date(week.start), 'MMM d')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {performanceStats.kpiBreakdown.map(({ kpi, weeklyValues }) => (
                      <tr key={kpi.id} className="border-b border-glass-border/20">
                        <td className="py-1 px-1">
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <span className="text-[7px] font-bold text-blue-500">{kpi.initials}</span>
                            </div>
                            <span className="truncate max-w-[60px]">{kpi.name}</span>
                          </div>
                        </td>
                        {weekHeaders.slice(-6).map(week => {
                          const value = weeklyValues[week.label];
                          const isPercentage = kpi.type === 'percentage';
                          const passed = kpi.passFailCriteriaEnabled && kpi.passFailValue !== undefined
                            ? (kpi.passFailOperator === 'gte' ? value >= kpi.passFailValue : value <= kpi.passFailValue)
                            : null;
                          return (
                            <td 
                              key={week.label} 
                              className={`text-center py-1 px-1 rounded-sm ${
                                value === 0 ? 'text-muted-foreground/50' :
                                passed === true ? 'bg-green-500/30 text-green-600 dark:text-green-400' :
                                passed === false ? 'bg-red-500/30 text-red-600 dark:text-red-400' :
                                'text-blue-500'
                              }`}
                            >
                              {value > 0 ? (isPercentage ? `${value}%` : value) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {performanceStats.kpiBreakdown.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No KPIs configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Gamification Card */}
        <Link href="/agent/gamification">
          <Card variant="glass" className="glass-card-hover h-full cursor-pointer overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Gamification</CardTitle>
                  <CardDescription>
                    Level {gamificationProfile?.level ?? 1} — {gamificationProfile?.currentTitle ?? "Rookie"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* XP Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{gamificationProfile?.totalXp?.toLocaleString() ?? 0} XP</span>
                    {gamificationProfile?.xpToNextLevel && gamificationProfile.xpToNextLevel > 0 ? (
                      <span className="text-muted-foreground">{gamificationProfile.xpToNextLevel.toLocaleString()} to go</span>
                    ) : (
                      <span className="text-amber-500 font-medium">Max Level!</span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, gamificationProfile?.xpProgress ?? 0)}%` }}
                    />
                  </div>
                </div>

                {/* Latest Badge */}
                {gamificationProfile?.badges?.length > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10">
                    <Award className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">Latest badge:</span>
                    <span className="text-xs font-medium">{gamificationProfile.badges[gamificationProfile.badges.length - 1].badge.name}</span>
                  </div>
                )}

                {/* Active Streak */}
                {gamificationProfile?.streaks?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Flame className={`h-4 w-4 ${gamificationProfile.streaks[0].currentCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground capitalize">{gamificationProfile.streaks[0].type} streak:</span>
                    <span className="text-sm font-bold">{gamificationProfile.streaks[0].currentCount}</span>
                  </div>
                )}

                {!gamificationProfile && (
                  <p className="text-xs text-muted-foreground text-center py-2">No gamification data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Mini Games Card */}
        <Link href="/mini-games">
          <Card variant="glass" className="glass-card-hover h-full cursor-pointer overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Swords className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Rock Paper Scissors</CardTitle>
                  <CardDescription>All-time Top 10</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {rpsLeaderboard.slice(0, 10).map((entry, index) => {
                  const isCurrentUser = entry.userId === currentUser?.id;
                  const rank = index + 1;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                  
                  return (
                    <div 
                      key={entry.userId} 
                      className={`flex items-center justify-between py-1 px-2 rounded-lg ${
                        isCurrentUser 
                          ? 'bg-purple-500/20 ring-1 ring-purple-500/50' 
                          : index < 3 ? 'bg-yellow-500/5' : 'bg-glass/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 text-center font-bold ${
                          rank === 1 ? 'text-yellow-400' : 
                          rank === 2 ? 'text-gray-300' : 
                          rank === 3 ? 'text-orange-400' : 
                          'text-muted-foreground'
                        }`}>
                          {medal || `#${rank}`}
                        </span>
                        <span className={`text-sm truncate max-w-[100px] ${isCurrentUser ? 'font-medium text-purple-400' : ''}`}>
                          {isCurrentUser ? 'YOU' : entry.name.split(' ')[0]}
                        </span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${
                        isCurrentUser ? 'text-purple-400' : 'text-muted-foreground'
                      }`}>
                        {entry.wins}
                      </span>
                    </div>
                  );
                })}
                {rpsLeaderboard.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Play RPS to see the leaderboard</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
