'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Star, TrendingUp, Award, Zap, Swords } from "lucide-react";
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfWeek, subWeeks, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { doc, onSnapshot, query, collection, where, orderBy } from 'firebase/firestore';

interface DailyAchievementLog {
  id?: string;
  agentId: string;
  competitionId: string;
  ruleId: string;
  date: any;
  points: number;
  value: number;
}

interface TrackerLog {
  id?: string;
  agentId: string;
  trackerKpiId: string;
  date: any;
  value: number;
}

interface AdditionalKpiLog {
  id?: string;
  agentId: string;
  kpiId: string;
  date: any;
  value: number;
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

interface RpsGameResult {
  id?: string;
  userId: string;
  userThrow: 'rock' | 'paper' | 'scissors';
  result: 'win' | 'loss' | 'draw';
  timestamp: any;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface Competition {
  id: string;
  name: string;
  podIds: string[];
  rules?: { id: string; name: string }[];
  teams?: Team[];
}

const LEADERBOARD_COMPETITION_KEY = 'agentDashboard_selectedCompetitionId';

export default function AgentDashboard() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>([]);
  const [trackerKpis, setTrackerKpis] = useState<{ id: string; name: string; initials: string }[]>([]);
  const [performanceLogs, setPerformanceLogs] = useState<AdditionalKpiLog[]>([]);
  const [additionalKpis, setAdditionalKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rpsGameResults, setRpsGameResults] = useState<RpsGameResult[]>([]);

  // Fetch user
  useEffect(() => {
    let mounted = true;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists() && mounted) {
              setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
            }
          });
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      }
      if (mounted) {
        setIsLoading(false);
      }
    });
    
    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  // Fetch competitions
  useEffect(() => {
    const compQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
      const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
      setCompetitions(fetchedComps);
      
      // Set default competition
      if (fetchedComps.length > 0) {
        const savedCompId = localStorage.getItem(LEADERBOARD_COMPETITION_KEY);
        if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
          setSelectedCompetitionId(savedCompId);
        } else {
          const defaultComp = fetchedComps[0];
          setSelectedCompetitionId(defaultComp.id);
          localStorage.setItem(LEADERBOARD_COMPETITION_KEY, defaultComp.id);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all agents for leaderboard names
  useEffect(() => {
    const agentsQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(agentsQuery, (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch achievement logs for current competition (all agents for leaderboards)
  useEffect(() => {
    if (!selectedCompetitionId) {
      setAchievementLogs([]);
      return;
    }

    const logsQuery = query(
      collection(db, 'dailyAchievements'),
      where('competitionId', '==', selectedCompetitionId)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setAchievementLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
    });

    return () => unsubscribe();
  }, [selectedCompetitionId]);

  // Fetch tracker logs for today
  useEffect(() => {
    if (!currentUser?.id) {
      setTrackerLogs([]);
      return;
    }

    const today = startOfDay(new Date());
    const todayTimestamp = { seconds: Math.floor(today.getTime() / 1000), nanoseconds: 0 };

    const logsQuery = query(
      collection(db, 'trackerLogs'),
      where('date', '==', todayTimestamp)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackerLog));
      setTrackerLogs(logs);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Fetch tracker KPIs
  useEffect(() => {
    const kpisQuery = query(collection(db, 'trackerKpis'), orderBy('name'));
    const unsubscribe = onSnapshot(kpisQuery, (snapshot) => {
      setTrackerKpis(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          initials: data.initials || '',
        };
      }));
    });
    return () => unsubscribe();
  }, []);

  // Fetch additional KPIs
  useEffect(() => {
    const kpisQuery = query(collection(db, 'additionalKpis'), orderBy('name'));
    const unsubscribe = onSnapshot(kpisQuery, (snapshot) => {
      setAdditionalKpis(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          name: data.name || '',
          initials: data.initials || '',
          type: data.type || 'numeric',
          passFailCriteriaEnabled: data.passFailCriteriaEnabled,
          passFailOperator: data.passFailOperator,
          passFailValue: data.passFailValue,
        } as AdditionalKpi;
      }));
    });
    return () => unsubscribe();
  }, []);

  // Fetch performance logs (all time for 6-week calculation)
  useEffect(() => {
    if (!currentUser?.id) {
      setPerformanceLogs([]);
      return;
    }

    const logsQuery = query(collection(db, 'additionalKpiLogs'));

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AdditionalKpiLog))
        .filter(log => log.agentId === currentUser.id);
      setPerformanceLogs(logs);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Fetch RPS game results for leaderboard (all-time)
  useEffect(() => {
    const logsQuery = query(collection(db, 'rpsGames'));
    
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RpsGameResult));
      setRpsGameResults(logs);
    });

    return () => unsubscribe();
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
      team.agentIds.forEach(agentId => {
        const agentLogs = achievementLogs.filter(log => log.agentId === agentId);
        agentLogs.forEach(log => {
          teamScores[team.id] += log.points || 0;
        });
      });
    });

    // Team leaderboard
    const teamLeaderboard = competition.teams
      ?.map(team => ({
        id: team.id,
        name: team.name,
        emoji: team.emoji,
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

    // Agent leaderboard (all agents with scores)
    const allAgents = competition.teams?.flatMap(team => team.agentIds) || [];
    const uniqueAgents = [...new Set(allAgents)];
    
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

    // Find user's rank and score
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
    // Calculate agent's tracker counts
    const agentCounts: Record<string, number> = {};
    trackerLogs
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
    trackerLogs.forEach(log => {
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

    // Find user's rank
    let userRank = '-';
    if (currentUser?.id) {
      const userIndex = leaderboard.findIndex(a => a.agentId === currentUser.id);
      if (userIndex !== -1) {
        userRank = String(userIndex + 1);
      }
    }

    return { agentTrackerData, leaderboard, userRank };
  }, [trackerLogs, trackerKpis, agents, currentUser?.id]);

  // Generate 6 weeks of data (starting Wednesday)
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
    const weekCount = performanceLogs.length;
    const weekPoints = performanceLogs.reduce((sum, log) => sum + (log.value || 0), 0);
    
    const kpiBreakdown = additionalKpis.map(kpi => {
      const weeklyValues: Record<string, number> = {};
      
      weekHeaders.forEach(week => {
        const weekLogs = performanceLogs.filter(log => {
          if (log.kpiId !== kpi.id) return false;
          const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date?.seconds ? log.date.seconds * 1000 : 0);
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
    
    return { weekCount, weekPoints, kpiBreakdown };
  }, [performanceLogs, additionalKpis, weekHeaders]);

  // Calculate RPS leaderboard (exclude test accounts)
  const rpsLeaderboard = useMemo(() => {
    const agentWins: Record<string, number> = {};
    rpsGameResults.forEach(game => {
      if (game.result === 'win' && game.userId) {
        agentWins[game.userId] = (agentWins[game.userId] || 0) + 1;
      }
    });

    const leaderboard = Object.entries(agentWins)
      .map(([userId, wins]) => {
        const agent = agents.find(a => a.id === userId);
        return {
          userId,
          name: agent?.name || 'Unknown',
          wins,
          email: agent?.email || '',
        };
      })
      .filter(entry => !entry.email.toLowerCase().endsWith('@test.com'))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    return leaderboard;
  }, [rpsGameResults, agents]);

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
        <Link href="/agent/competitions">
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
                {/* Team Leaderboard */}
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
                          <span className="text-sm font-medium">{team.emoji} {team.name}</span>
                        </div>
                        <span className="text-sm font-bold">{team.score.toLocaleString()}</span>
                      </div>
                    ))}
                    {competitionStats.teamLeaderboard.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No teams</p>
                    )}
                  </div>
                </div>

                {/* Agent Leaderboard */}
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
                    {/* Show user if not in top 3 */}
                    {competitionStats.userRank !== '-' && parseInt(competitionStats.userRank) > 3 && (
                      <>
                        <div className="flex items-center justify-center py-1">
                          <span className="text-xs text-muted-foreground">...</span>
                        </div>
                        <div 
                          className="flex items-center justify-between p-2 rounded-lg bg-primary/20 ring-1 ring-primary/50"
                        >
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
        <Link href="/agent/trackers">
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
                {/* Your Trackers */}
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

                {/* Tracker Leaderboard */}
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
        <Link href="/agent/performance">
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

        {/* Mini Games Card */}
        <Link href="/agent/rps-game">
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
                  <p className="text-xs text-muted-foreground text-center py-4">No games played</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
