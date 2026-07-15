'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AppPod } from '@/lib/contracts';
import { TeamsSendButton } from "@/components/teams-send-button";

type AdditionalKpiType = 'number' | 'percentage' | 'scoreOutOf';
type KpiSortOrder = 'desc' | 'asc';

interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: AdditionalKpiType;
  maxValue?: number;
  sortOrder?: KpiSortOrder;
}

interface AdditionalKpiLog {
  id: string;
  kpiId: string;
  userId: string | null;
  userName: string | null;
  value: number;
  date: string;
}

interface AppUser {
  id: string;
  name: string;
}

type Timeframe = 'thisWeek' | 'thisMonth' | 'last6weeks' | 'allTime';

interface LeaderboardEntry {
  agentId: string;
  agentName: string;
  score: number;
  rank: number;
}

interface KpiLeaderboard {
  kpi: AdditionalKpi;
  entries: LeaderboardEntry[];
}

const PERFORMANCE_POD_KEY = 'performanceDashboard_selectedPodId';
const PERFORMANCE_TIMEFRAME_KEY = 'performanceDashboard_timeframe';

const getMedalStyle = (rank: number) => {
  switch (rank) {
    case 1: return 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50';
    case 2: return 'bg-gray-400/30 text-gray-300 border-gray-400/50';
    case 3: return 'bg-orange-400/30 text-orange-400 border-orange-400/50';
    default: return 'bg-muted/30 text-muted-foreground border-muted';
  }
};

export default function PerformanceDashboard() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('thisWeek');
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedInitialData = React.useRef(false);

  useEffect(() => {
    const savedPodId = localStorage.getItem(PERFORMANCE_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedTimeframe = localStorage.getItem(PERFORMANCE_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const savedPodId = localStorage.getItem(PERFORMANCE_POD_KEY);
        const query = savedPodId && savedPodId !== 'all'
          ? `?podId=${encodeURIComponent(savedPodId)}`
          : '';
        const response = await fetch(`/api/performance/dashboard${query}`);
        if (!response.ok) throw new Error('Failed to load performance dashboard');
        const data = await response.json();
        setPods(data.pods || []);
        setKpis(data.kpis || []);
        setAgents(data.users || []);
        setLogs(data.logs || []);
        hasLoadedInitialData.current = true;
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!hasLoadedInitialData.current) return;
    async function fetchLogs() {
      setIsLoading(true);
      try {
        let url = '/api/performance/kpi-logs';
        if (selectedPodId !== 'all') {
          url += `?podId=${selectedPodId}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      }
      setIsLoading(false);
    }
    fetchLogs();
  }, [selectedPodId]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(PERFORMANCE_POD_KEY, podId);
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf as Timeframe);
    localStorage.setItem(PERFORMANCE_TIMEFRAME_KEY, tf);
  };

  const filteredLogs = useMemo(() => {
    if (logs.length === 0 || kpis.length === 0) return [];

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timeframe) {
      case 'thisWeek':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last6weeks': {
        const maxDateByKpi: Record<string, Date> = {};
        logs.forEach(log => {
          const d = new Date(log.date);
          if (!maxDateByKpi[log.kpiId] || d > maxDateByKpi[log.kpiId]) {
            maxDateByKpi[log.kpiId] = d;
          }
        });
        return logs.filter(log => {
          const maxDate = maxDateByKpi[log.kpiId];
          if (!maxDate) return false;
          const logDate = new Date(log.date);
          const windowStart = subDays(maxDate, 42);
          return logDate >= windowStart && logDate <= maxDate;
        });
      }
      case 'allTime':
      default:
        if (logs.length === 0) return [];
        const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        startDate = new Date(sortedLogs[0].date);
        endDate = new Date(sortedLogs[sortedLogs.length - 1].date);
        break;
    }

    return logs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= startDate && logDate <= endDate;
    });
  }, [logs, timeframe, kpis]);

  const kpiLeaderboards = useMemo((): KpiLeaderboard[] => {
    if (kpis.length === 0) return [];

    return kpis.map(kpi => {
      const kpiLogs = filteredLogs.filter(log => log.kpiId === kpi.id);
      const useWeeklyAverage = timeframe === 'last6weeks' && (kpi.type === 'percentage' || kpi.type === 'scoreOutOf');

      const kpiMaxDate = useWeeklyAverage
        ? kpiLogs.reduce<Date | null>((latest, log) => {
            const d = new Date(log.date);
            return !latest || d > latest ? d : latest;
          }, null)
        : null;

      const agentData: Record<string, { sum: number; count: number }> = {};
      kpiLogs.forEach(log => {
        if (!log.userId) return;
        if (!agentData[log.userId]) agentData[log.userId] = { sum: 0, count: 0 };
        agentData[log.userId].sum += log.value;
        agentData[log.userId].count += 1;
      });

      const agentScores: Record<string, number> = {};
      Object.entries(agentData).forEach(([agentId, data]) => {
        if (useWeeklyAverage && kpiMaxDate) {
          const agentLogs = kpiLogs.filter(log => log.userId === agentId);
          const weeklyAverages: number[] = [];
          for (let i = 0; i < 6; i++) {
            const weekEnd = new Date(kpiMaxDate);
            weekEnd.setDate(kpiMaxDate.getDate() - i * 7);
            weekEnd.setHours(23, 59, 59, 999);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekEnd.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);
            const weekLogs = agentLogs.filter(log => {
              const d = new Date(log.date);
              return d >= weekStart && d <= weekEnd;
            });
            weeklyAverages.push(weekLogs.length > 0 ? weekLogs.reduce((s, log) => s + log.value, 0) / weekLogs.length : 0);
          }
          agentScores[agentId] = weeklyAverages.reduce((s, avg) => s + avg, 0) / 6;
        } else if (kpi.type === 'percentage') {
          agentScores[agentId] = data.count > 0 ? data.sum / data.count : 0;
        } else {
          agentScores[agentId] = data.sum;
        }
      });

      const agentIds = Object.keys(agentScores);
      const entries = agentIds.map(agentId => {
        const agent = agents.find(a => a.id === agentId);
        return {
          agentId,
          agentName: agent?.name || 'Unknown Agent',
          score: agentScores[agentId],
        } as LeaderboardEntry;
      });

      const sortedEntries = entries.sort((a, b) => {
        if (kpi.sortOrder === 'asc') {
          return a.score - b.score;
        }
        return b.score - a.score;
      });

      const rankedEntries: LeaderboardEntry[] = sortedEntries.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      return {
        kpi,
        entries: rankedEntries.slice(0, 5),
      };
    });
  }, [kpis, filteredLogs, agents, timeframe]);

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'thisWeek': return 'This Week';
      case 'thisMonth': return 'This Month';
      case 'last6weeks': return 'Last 6 Weeks';
      case 'allTime': return 'All Time';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">KPI Performance Leaderboards</p>
        </div>
        <TeamsSendButton category="daily_summary">
          Share Summary
        </TeamsSendButton>
      </div>

      <Card className="frosted-glass">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="grid gap-2">
              <Label>Pod</Label>
              <Select onValueChange={handlePodChange} value={selectedPodId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Pod" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pods</SelectItem>
                  {pods.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Timeframe</Label>
              <Select onValueChange={handleTimeframeChange} value={timeframe}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {kpis.length === 0 ? (
        <Card className="frosted-glass">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No KPIs Configured</p>
              <p className="text-sm">Add KPIs in the Additional KPIs section to see leaderboards.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiLeaderboards.map(({ kpi, entries }) => (
            <Card key={kpi.id} className="frosted-glass overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold">{kpi.initials || '📋'}</span>
                    </div>
                    <div>
                      <CardTitle className="text-base">{kpi.name}</CardTitle>
                      {kpi.type === 'percentage' && (
                        <span className="text-xs text-muted-foreground">{kpi.type}</span>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    kpi.sortOrder === 'asc'
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-green-500/10 text-green-500'
                  )}>
                    {kpi.sortOrder === 'asc' ? (
                      <>
                        <TrendingDown className="h-3 w-3" />
                        <span>Lower is better</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3 w-3" />
                        <span>Higher is better</span>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No data for this KPI</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      <div
                        key={entry.agentId}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg transition-colors",
                          entry.rank <= 3 ? 'bg-muted/50' : 'hover:bg-muted/30'
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                          getMedalStyle(entry.rank)
                        )}>
                          {entry.rank}
                        </div>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {generateInitials(entry.agentName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {entry.agentName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "font-bold tabular-nums",
                            entry.rank <= 3 ? 'text-foreground' : 'text-primary'
                          )}>
                            {kpi.type === 'percentage'
                              ? `${entry.score.toFixed(1)}%`
                              : entry.score.toLocaleString()
                            }
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {kpis.length > 0 && kpiLeaderboards.every(lb => lb.entries.length === 0) && (
        <Card className="frosted-glass">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No Data for {getTimeframeLabel()}</p>
              <p className="text-sm">No KPI logs recorded for the selected timeframe and pod.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
