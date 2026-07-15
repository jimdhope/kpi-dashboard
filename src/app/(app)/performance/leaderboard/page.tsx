'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart3, Filter, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AppPod, AppUser } from '@/lib/contracts';

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
  userId: string | null;
  kpiId: string;
  date: string;
  value: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
}

type Timeframe = 'weekly' | 'last6weeks' | 'monthly' | 'allTime';

const LEADERBOARD_POD_KEY = 'additionalLeaderboard_selectedPodId';
const LEADERBOARD_KPI_KEY = 'additionalLeaderboard_selectedKpiId';
const LEADERBOARD_TIMEFRAME_KEY = 'additionalLeaderboard_timeframe';

const getMedalStyle = (rank: number) => {
  switch (rank) {
    case 1: return 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50';
    case 2: return 'bg-gray-400/30 text-gray-300 border-gray-400/50';
    case 3: return 'bg-orange-400/30 text-orange-400 border-orange-400/50';
    default: return 'bg-muted/30 text-muted-foreground border-muted';
  }
};

const getMedalEmoji = (rank: number) => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
};

export default function AdditionalLeaderboardPage() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [selectedKpiId, setSelectedKpiId] = useState<string>('overall');
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedInitialData = React.useRef(false);

  // Load saved filters
  useEffect(() => {
    const savedPodId = localStorage.getItem(LEADERBOARD_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedKpiId = localStorage.getItem(LEADERBOARD_KPI_KEY);
    if (savedKpiId) setSelectedKpiId(savedKpiId);
    const savedTimeframe = localStorage.getItem(LEADERBOARD_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
  }, []);

  const handlePodChange = (podId: string) => { 
    setSelectedPodId(podId); 
    localStorage.setItem(LEADERBOARD_POD_KEY, podId); 
  };
  const handleKpiChange = (kpiId: string) => { 
    setSelectedKpiId(kpiId); 
    localStorage.setItem(LEADERBOARD_KPI_KEY, kpiId); 
  };
  const handleTimeframeChange = (tf: string) => { 
    setTimeframe(tf as Timeframe); 
    localStorage.setItem(LEADERBOARD_TIMEFRAME_KEY, tf); 
  };

  // Fetch base data (pods, kpis, users)
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const savedPodId = localStorage.getItem(LEADERBOARD_POD_KEY);
        const query = savedPodId && savedPodId !== 'all' ? `?podId=${encodeURIComponent(savedPodId)}` : '';
        const response = await fetch(`/api/performance/dashboard${query}`);
        if (!response.ok) throw new Error('Failed to load performance leaderboard');
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

  // Fetch logs based on pod filter
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
        console.error("Error fetching logs:", err);
      }
      setIsLoading(false);
    }
    fetchLogs();
  }, [selectedPodId]);
  
  const filteredLogs = useMemo(() => {
    if (timeframe === 'last6weeks') {
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
        const windowStart = new Date(maxDate);
        windowStart.setDate(windowStart.getDate() - 42);
        windowStart.setHours(0, 0, 0, 0);
        return logDate >= windowStart && logDate <= maxDate;
      });
    }
    const now = new Date();
    let startDate: Date;
    switch (timeframe) {
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'allTime':
      default:
        return logs;
    }
    return logs.filter(log => new Date(log.date) >= startDate);
  }, [logs, timeframe]);

  const leaderboardData = useMemo((): LeaderboardEntry[] => {
    const podAgents = selectedPodId === 'all'
      ? agents.filter(a => a.roles?.includes('agent'))
      : agents.filter(a => a.roles?.includes('agent'));
    
    if (podAgents.length === 0) return [];
  
    let logsToProcess = filteredLogs;
    let kpi: AdditionalKpi | undefined;
  
    if (selectedKpiId !== 'overall') {
      kpi = kpis.find(k => k.id === selectedKpiId);
      if (kpi) {
        logsToProcess = filteredLogs.filter(log => log.kpiId === selectedKpiId);
      }
    }

    const useWeeklyAverage = timeframe === 'last6weeks' && kpi && (kpi.type === 'percentage' || kpi.type === 'scoreOutOf');
    const kpiMaxDate = useWeeklyAverage
      ? logsToProcess.reduce<Date | null>((latest, log) => {
          const d = new Date(log.date);
          return !latest || d > latest ? d : latest;
        }, null)
      : null;
  
    const agentScores: Record<string, { totalValue: number; count: number }> = {};
    podAgents.forEach(agent => agent.id && (agentScores[agent.id] = { totalValue: 0, count: 0 }));
  
    logsToProcess.forEach(log => {
      if (log.userId && agentScores.hasOwnProperty(log.userId)) {
        agentScores[log.userId].totalValue += log.value;
        agentScores[log.userId].count++;
      }
    });
  
    return podAgents.map(agent => {
      const agentData = agent.id ? agentScores[agent.id] : { totalValue: 0, count: 0 };
      let finalScore = 0;

      if (useWeeklyAverage && kpiMaxDate && agent.id) {
        const agentLogs = logsToProcess.filter(log => log.userId === agent.id);
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
        finalScore = weeklyAverages.reduce((s, avg) => s + avg, 0) / 6;
      } else if (kpi && kpi.type === 'percentage') {
        finalScore = agentData.count > 0 ? agentData.totalValue / agentData.count : 0;
      } else {
        finalScore = agentData.totalValue;
      }
  
      return {
        id: agent.id || '',
        name: agent.name,
        score: finalScore,
        avatarUrl: agent.avatarUrl ?? undefined,
        avatarInitials: agent.avatarInitials ?? undefined,
        avatarBgColor: agent.avatarBgColor ?? undefined,
      };
    }).sort((a, b) => {
        // Sort based on the KPI's sortOrder if a specific KPI is selected
        if (kpi && kpi.sortOrder === 'asc') { // Lower is better
            return a.score - b.score;
        }
        // Higher is better (default for 'number', 'scoreOutOf', and 'overall')
        return b.score - a.score;
    });
  }, [filteredLogs, agents, selectedPodId, selectedKpiId, kpis, timeframe]);

  const rankedEntries = useMemo(() => {
    return leaderboardData.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [leaderboardData]);

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Leaderboard Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}>
                <SelectTrigger id="pod-select"><SelectValue placeholder="Select Pod" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pods</SelectItem>
                  {pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kpi-select">KPI</Label>
              <Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}>
                <SelectTrigger id="kpi-select"><SelectValue placeholder="Select KPI" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall Score</SelectItem>
                  {kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.initials} {k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeframe-select">Timeframe</Label>
              <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}>
                <SelectTrigger id="timeframe-select"><SelectValue placeholder="Select Timeframe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Additional KPI Leaderboard</CardTitle>
          <CardDescription>Ranking based on the selected filters.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-[300px] w-full" /></div>
          ) : rankedEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No data available for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rankedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-colors",
                    entry.rank === 1 ? 'bg-yellow-500/10 border border-yellow-500/30' :
                    entry.rank === 2 ? 'bg-gray-400/10 border border-gray-400/30' :
                    entry.rank === 3 ? 'bg-orange-400/10 border border-orange-400/30' :
                    'bg-muted/30 hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border",
                    getMedalStyle(entry.rank)
                  )}>
                    {entry.rank <= 3 ? getMedalEmoji(entry.rank) : entry.rank}
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ backgroundColor: entry.avatarBgColor || 'hsl(var(--primary))' }}>
                      {entry.avatarInitials || generateInitials(entry.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-medium truncate block">
                      {entry.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-xl font-bold tabular-nums",
                      entry.rank <= 3 ? 'text-foreground' : 'text-primary'
                    )}>
                      {entry.score.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
