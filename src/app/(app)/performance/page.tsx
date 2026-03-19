'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';

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
  agentId: string;
  podId: string;
  kpiId: string;
  date: any;
  value: number;
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
  const [pods, setPods] = useState<Pod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('thisWeek');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedPodId = localStorage.getItem(PERFORMANCE_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedTimeframe = localStorage.getItem(PERFORMANCE_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes = [
      onSnapshot(query(collection(db, 'pods'), orderBy('name')), snap => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))),
      onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), snap => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))),
      onSnapshot(query(collection(db, 'users'), orderBy('name')), snap => setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)))),
    ];

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let logsQuery;
    if (selectedPodId === 'all') {
      logsQuery = query(collection(db, 'additionalKpiLogs'));
    } else {
      logsQuery = query(collection(db, 'additionalKpiLogs'), where('podId', '==', selectedPodId));
    }

    const unsubscribe = onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog)));
      setIsLoading(false);
    }, () => {
      setIsLoading(false);
    });
    return () => unsubscribe();
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
      case 'last6weeks':
        startDate = startOfWeek(subWeeks(now, 5), { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'allTime':
      default:
        if (logs.length === 0) return [];
        const sortedLogs = [...logs].sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
        startDate = sortedLogs[0].date.toDate();
        endDate = sortedLogs[sortedLogs.length - 1].date.toDate();
        break;
    }

    return logs.filter(log => {
      const logDate = log.date.toDate();
      return logDate >= startDate && logDate <= endDate;
    });
  }, [logs, timeframe, kpis]);

  const kpiLeaderboards = useMemo((): KpiLeaderboard[] => {
    if (kpis.length === 0) return [];

    return kpis.map(kpi => {
      const kpiLogs = filteredLogs.filter(log => log.kpiId === kpi.id);

      const agentData: Record<string, { sum: number; count: number }> = {};
      kpiLogs.forEach(log => {
        if (!agentData[log.agentId]) agentData[log.agentId] = { sum: 0, count: 0 };
        agentData[log.agentId].sum += log.value;
        agentData[log.agentId].count += 1;
      });

      const agentScores: Record<string, number> = {};
      Object.entries(agentData).forEach(([agentId, data]) => {
        if (kpi.type === 'percentage') {
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
  }, [kpis, filteredLogs, agents]);

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
      <div>
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <p className="text-muted-foreground">KPI Performance Leaderboards</p>
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
