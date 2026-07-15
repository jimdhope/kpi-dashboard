'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfWeek,
  endOfDay,
  format,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  subDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter, BarChartHorizontal, User, LayoutGrid } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppPod, AppUser } from '@/lib/contracts';
import { cn } from '@/lib/utils';

type AdditionalKpiType = 'number' | 'percentage' | 'scoreOutOf';
type KpiSortOrder = 'desc' | 'asc';

interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: AdditionalKpiType;
  maxValue?: number;
  sortOrder?: KpiSortOrder;
  passFailCriteriaEnabled?: boolean;
  passFailOperator?: 'gte' | 'lte';
  passFailValue?: number;
}

interface KpiLogResponse {
  id: string;
  kpiId: string;
  kpiName: string;
  userId: string | null;
  userName: string | null;
  value: number;
  date: string;       // When the KPI was achieved
  loggedAt: string;  // When it was imported
}

const KPI_BREAKDOWN_POD_KEY = 'kpiBreakdown_selectedPodId';
const KPI_BREAKDOWN_TIMEFRAME_KEY = 'kpiBreakdown_timeframe';
const KPI_BREAKDOWN_WEEKSTART_KEY = 'kpiBreakdown_weekStartsOn';
const KPI_BREAKDOWN_VIEWMODE_KEY = 'kpiBreakdown_viewMode';
const KPI_BREAKDOWN_SORTMODE_KEY = 'kpiBreakdown_kpiSortMode';

type Timeframe = 'last6weeks' | 'thisWeek' | 'thisMonth' | 'allTime' | 'custom';
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ViewMode = 'agent' | 'kpi';

function getKpiTarget(kpi: AdditionalKpi): { value: number; label: string } | null {
  if (kpi.type === 'scoreOutOf' && kpi.maxValue !== undefined && kpi.maxValue !== null) {
    return { value: kpi.maxValue, label: String(kpi.maxValue) };
  }
  if (kpi.type !== 'scoreOutOf' && kpi.passFailCriteriaEnabled && kpi.passFailValue !== undefined && kpi.passFailValue !== null) {
    const suffix = kpi.type === 'percentage' ? '%' : '';
    return { value: kpi.passFailValue, label: `${kpi.passFailValue}${suffix}` };
  }
  return null;
}

interface WeeklyKpiTotals {
  [kpiId: string]: {
      value: number;
      count: number;
  };
}

interface AgentWeeklyData {
  agentId: string;
  agentName: string;
  weeklyScores: {
    [weekOf: string]: WeeklyKpiTotals;
  };
}

export default function KpiBreakdownPage() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<KpiLogResponse[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartDay>(4);
  const [viewMode, setViewMode] = useState<ViewMode>('agent');
  const [kpiSortMode, setKpiSortMode] = useState<'name' | 'score'>('name');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | undefined>(
    { from: subDays(new Date(), 42), to: new Date() }
  );

  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedInitialData = React.useRef(false);

  useEffect(() => {
    const savedPodId = localStorage.getItem(KPI_BREAKDOWN_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedTimeframe = localStorage.getItem(KPI_BREAKDOWN_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
    const savedWeekStart = localStorage.getItem(KPI_BREAKDOWN_WEEKSTART_KEY);
    if (savedWeekStart) setWeekStartsOn(parseInt(savedWeekStart, 10) as WeekStartDay);
    const savedViewMode = localStorage.getItem(KPI_BREAKDOWN_VIEWMODE_KEY) as ViewMode | null;
    if (savedViewMode) setViewMode(savedViewMode);
    const savedSortMode = localStorage.getItem(KPI_BREAKDOWN_SORTMODE_KEY) as 'name' | 'score' | null;
    if (savedSortMode) setKpiSortMode(savedSortMode);
  }, []);

  const handlePodChange = (podId: string) => { setSelectedPodId(podId); localStorage.setItem(KPI_BREAKDOWN_POD_KEY, podId); };
  const handleTimeframeChange = (tf: string) => { 
    setTimeframe(tf as Timeframe); 
    localStorage.setItem(KPI_BREAKDOWN_TIMEFRAME_KEY, tf);
    if (tf !== 'custom') {
      // Reset custom date range when switching away from custom
      setCustomDateRange({ from: subDays(new Date(), 42), to: new Date() });
    }
  };
  const handleWeekStartChange = (day: string) => { setWeekStartsOn(parseInt(day, 10) as WeekStartDay); localStorage.setItem(KPI_BREAKDOWN_WEEKSTART_KEY, day); };
  const handleViewModeChange = (mode: string) => { setViewMode(mode as ViewMode); localStorage.setItem(KPI_BREAKDOWN_VIEWMODE_KEY, mode); };
  const handleSortModeChange = (mode: 'name' | 'score') => { setKpiSortMode(mode); localStorage.setItem(KPI_BREAKDOWN_SORTMODE_KEY, mode); };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const savedPodId = localStorage.getItem(KPI_BREAKDOWN_POD_KEY);
        const query = savedPodId && savedPodId !== 'all' ? `?podId=${encodeURIComponent(savedPodId)}` : '';
        const response = await fetch(`/api/performance/dashboard${query}`);
        if (!response.ok) throw new Error('Failed to load KPI breakdown');
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
        const params = new URLSearchParams();
        if (selectedPodId !== 'all') {
          params.append('podId', selectedPodId);
        }
        // Fetch all logs for now (no timeframe filter in API yet)
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setLogs(Array.isArray(data) ? data : data.logs || []);
        }
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
      setIsLoading(false);
    }
    fetchLogs();
  }, [selectedPodId]);
  
  const filteredLogs = useMemo(() => {
    if (timeframe === 'allTime') {
      return logs;
    }
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let maxDateByKpi: Record<string, Date> | null = null;
    
    switch (timeframe) {
      case 'thisWeek':
        startDate = startOfWeek(now, { weekStartsOn });
        endDate = endOfWeek(now, { weekStartsOn });
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last6weeks':
      default:
        const maxByKpi: Record<string, Date> = {};
        logs.forEach(log => {
          const d = new Date(log.date);
          if (!maxByKpi[log.kpiId] || d > maxByKpi[log.kpiId]) {
            maxByKpi[log.kpiId] = d;
          }
        });
        maxDateByKpi = maxByKpi;
        startDate = new Date(0);
        endDate = new Date();
        break;
      case 'custom':
        if (!customDateRange?.from || !customDateRange?.to) {
          return logs;
        }
        startDate = customDateRange.from;
        endDate = endOfDay(customDateRange.to);
        break;
    }

    return logs.filter(log => {
      const logDate = new Date(log.date);
      if (maxDateByKpi) {
        const maxDate = maxDateByKpi[log.kpiId];
        if (!maxDate) return false;
        return logDate >= subDays(maxDate, 42) && logDate <= maxDate;
      }
      return logDate >= startDate && logDate <= endDate;
    });
  }, [logs, timeframe, weekStartsOn, customDateRange]);
  

  function getSixWeekScore(
    weeklyScores: AgentWeeklyData['weeklyScores'],
    kpiId: string,
    kpiType: AdditionalKpiType,
    avgWeeks: string[]
  ): number {
    const useWeeklyAverage = kpiType === 'percentage' || kpiType === 'scoreOutOf';
    let total = 0;
    avgWeeks.forEach(week => {
      const data = weeklyScores[week]?.[kpiId];
      if (data) {
        total += useWeeklyAverage
          ? (data.count > 0 ? data.value / data.count : 0)
          : data.value;
      }
    });
    if (useWeeklyAverage) return total / 6;
    return total;
  }

  const { processedData, weekHeaders, podKpis, kpiWeekHeaders, kpiAgentRanks } = useMemo(() => {
    if (filteredLogs.length === 0 || kpis.length === 0) {
      return { processedData: [], weekHeaders: [], podKpis: [], kpiWeekHeaders: {}, kpiAgentRanks: {} };
    }
    
    const podAgents = agents.filter(a => {
      const isAgent = a.roles?.includes('agent');
      if (selectedPodId === 'all') return isAgent;
      return isAgent && a.podIds?.includes(selectedPodId);
    });
    
    if (podAgents.length === 0) {
        return { processedData: [], weekHeaders: [], podKpis: [], kpiWeekHeaders: {}, kpiAgentRanks: {} };
    }
    
    const podKpiIds = new Set(filteredLogs.map(log => log.kpiId));
    const podKpis = kpis.filter(kpi => podKpiIds.has(kpi.id)).sort((a,b) => a.name.localeCompare(b.name));

    const agentData: AgentWeeklyData[] = podAgents.map(agent => ({
        agentId: agent.id,
        agentName: agent.name,
        weeklyScores: {}
    }));

    const weeks = new Set<string>();

    filteredLogs.forEach(log => {
        if (!log.userId) return; // Skip logs without userId
        const weekStart = startOfWeek(new Date(log.date), { weekStartsOn });
        const weekOf = format(weekStart, 'MMM dd, yyyy');
        weeks.add(weekOf);

        const agent = agentData.find(a => a.agentId === log.userId);
        const kpiDetails = kpis.find(k => k.id === log.kpiId);

        if (agent && kpiDetails) {
            if (!agent.weeklyScores[weekOf]) {
                agent.weeklyScores[weekOf] = {};
            }
            if (!agent.weeklyScores[weekOf][log.kpiId]) {
                agent.weeklyScores[weekOf][log.kpiId] = { value: 0, count: 0 };
            }
            
            agent.weeklyScores[weekOf][log.kpiId].value += log.value;
            agent.weeklyScores[weekOf][log.kpiId].count += 1;
        }
    });

    const weekHeaders = Array.from(weeks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    const kpiWeekHeaders: Record<string, string[]> = {};
    podKpis.forEach(kpi => {
      const kpiLogs = filteredLogs.filter(log => log.kpiId === kpi.id);
      if (kpiLogs.length === 0) { kpiWeekHeaders[kpi.id] = []; return; }
      const weekSet = new Set<string>();
      kpiLogs.forEach(log => {
        const ws = startOfWeek(new Date(log.date), { weekStartsOn });
        weekSet.add(format(ws, 'MMM dd, yyyy'));
      });
      kpiWeekHeaders[kpi.id] = Array.from(weekSet)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .slice(-6);
    });
    
    const kpiAgentRanks: Record<string, Record<string, number>> = {};
    if (filteredLogs.length > 0 && timeframe === 'last6weeks') {
      podKpis.forEach(kpi => {
        const avgWeeks = kpiWeekHeaders[kpi.id] || [];
        if (avgWeeks.length === 0) return;
        const entries: { agentId: string; score: number }[] = [];
        agentData.forEach(agent => {
          const score = getSixWeekScore(agent.weeklyScores, kpi.id, kpi.type, avgWeeks);
          const hasData = avgWeeks.some(week => agent.weeklyScores[week]?.[kpi.id] !== undefined);
          if (hasData) entries.push({ agentId: agent.agentId, score });
        });
        const lowerIsBetter = kpi.sortOrder === 'asc';
        entries.sort((a, b) => lowerIsBetter ? a.score - b.score : b.score - a.score);
        const ranks: Record<string, number> = {};
        let currentRank = 0;
        entries.forEach((e, i) => {
          if (i === 0 || e.score !== entries[i - 1].score) currentRank++;
          if (currentRank <= 3) ranks[e.agentId] = currentRank;
        });
        kpiAgentRanks[kpi.id] = ranks;
      });
    }
    
    return { processedData: agentData.sort((a, b) => a.agentName.localeCompare(b.agentName)), weekHeaders, podKpis, kpiWeekHeaders, kpiAgentRanks };

  }, [filteredLogs, agents, selectedPodId, kpis, weekStartsOn, timeframe]);

  const weekDayOptions = [
    { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  const getScoreCellClass = (score: number | undefined, kpi: AdditionalKpi): string => {
    if (score === undefined || !kpi.passFailCriteriaEnabled) {
      return '';
    }
  
    const passValue = kpi.passFailValue;
    if (passValue === undefined || passValue === null) {
      return '';
    }
  
    let passed = false;
    if (kpi.passFailOperator === 'gte') {
      passed = score >= passValue;
    } else if (kpi.passFailOperator === 'lte') {
      passed = score <= passValue;
    }
  
    return passed ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50';
  };

  const sevenWeekHeaders = useMemo(() => {
    if (timeframe !== 'last6weeks') return weekHeaders;
    if (weekHeaders.length === 0) return [];
    const maxWeekDate = new Date(weekHeaders[weekHeaders.length - 1]);
    const headers: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(maxWeekDate);
      d.setDate(d.getDate() - i * 7);
      headers.push(format(d, 'MMM dd, yyyy'));
    }
    return headers;
  }, [weekHeaders, timeframe]);

  const isLongTimeframe = timeframe === 'last6weeks' || timeframe === 'allTime';

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> KPI Breakdown Filters</CardTitle>
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
              <Label htmlFor="timeframe-select">Timeframe</Label>
              <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}>
                <SelectTrigger id="timeframe-select"><SelectValue placeholder="Select Timeframe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {timeframe === 'custom' && (
              <>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-from">From:</Label>
                  <input
                    id="custom-from"
                    type="date"
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={customDateRange?.from ? customDateRange.from.toISOString().split('T')[0] : ''}
                    onChange={(e) => setCustomDateRange({ 
                      from: new Date(e.target.value), 
                      to: customDateRange?.to || new Date() 
                    })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-to">To:</Label>
                  <input
                    id="custom-to"
                    type="date"
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={customDateRange?.to ? customDateRange.to.toISOString().split('T')[0] : ''}
                    onChange={(e) => setCustomDateRange({ 
                      from: customDateRange?.from || subDays(new Date(), 42), 
                      to: new Date(e.target.value) 
                    })}
                  />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="weekstart-select">Week Starts On</Label>
              <Select onValueChange={handleWeekStartChange} value={String(weekStartsOn)} disabled={isLoading}>
                <SelectTrigger id="weekstart-select"><SelectValue placeholder="Select Day" /></SelectTrigger>
                <SelectContent>{weekDayOptions.map(day => <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="frosted-glass flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><BarChartHorizontal className="h-5 w-5" /> Weekly KPI Breakdown</CardTitle>
            <CardDescription>
              {isLongTimeframe 
                ? 'Performance summary grouped for clear long-term tracking.' 
                : 'Weekly total scores for each agent across all relevant KPIs.'}
            </CardDescription>
          </div>
          {isLongTimeframe && (
            <div className="flex items-center gap-3">
              <Tabs value={viewMode} onValueChange={handleViewModeChange} className="hidden sm:block">
                <TabsList className="bg-muted/50 border">
                  <TabsTrigger value="agent" className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Agent View
                  </TabsTrigger>
                  <TabsTrigger value="kpi" className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" /> KPI View
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {viewMode === 'kpi' && timeframe === 'last6weeks' && (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => handleSortModeChange('name')}
                    className={`px-2.5 py-1.5 rounded-l-md border transition-colors ${
                      kpiSortMode === 'name'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-input hover:bg-muted/80'
                    }`}
                  >
                    Name A-Z
                  </button>
                  <button
                    onClick={() => handleSortModeChange('score')}
                    className={`px-2.5 py-1.5 rounded-r-md border transition-colors ${
                      kpiSortMode === 'score'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-input hover:bg-muted/80'
                    }`}
                  >
                    ↓ Score
                  </button>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : processedData.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No scores logged for the selected filters.</p>
        ) : (
          <div className="flex-1 flex flex-col">
            {isLongTimeframe ? (
              viewMode === 'agent' ? (
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {processedData.length} agent tables
                  </span>
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {podKpis.length} KPI tables
                  </span>
                </div>
              )
            ) : null}
            {isLongTimeframe ? (
              viewMode === 'agent' ? (
                <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
                  {processedData.map(agentData => (
                    <Card key={agentData.agentId} className="border shadow-sm overflow-hidden flex flex-col bg-card/50 min-w-[380px] flex-1 max-w-[600px]">
                      <CardHeader className="bg-gray-200 dark:bg-gray-700 py-3 px-4 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" /> 
                          <span className="text-gray-800 dark:text-gray-100">{agentData.agentName}</span>
                        </CardTitle>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-100 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <TableHead className="w-[140px] text-xs font-bold uppercase text-gray-700 dark:text-gray-200">KPI</TableHead>
                              {sevenWeekHeaders.map(week => (
                                <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-gray-700 dark:text-gray-200">
                                  {format(endOfWeek(new Date(week), { weekStartsOn }), 'dd/MM')}
                                </TableHead>
                              ))}
                              {timeframe === 'last6weeks' && (
                                <TableHead className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-primary border-l-2 border-primary">AVG</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {podKpis.map((kpi, idx) => {
                              const avgWeeks = (timeframe === 'last6weeks' ? kpiWeekHeaders[kpi.id] : []);
                              return (
                              <TableRow key={kpi.id} className={`h-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                                <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-gray-100/30 dark:bg-gray-700/30 text-gray-800 dark:text-gray-200 break-words max-w-[140px]">
                                  <div className="flex items-center gap-1">
                                    <span className="break-words">{kpi.name}</span>
                                    <span className={cn(
                                      "text-[9px] font-medium shrink-0",
                                      kpi.sortOrder === 'asc' ? 'text-blue-500' : 'text-green-500'
                                    )}>
                                      {kpi.sortOrder === 'asc' ? '↓' : '↑'}
                                    </span>
                                    {(() => {
                                      const t = getKpiTarget(kpi);
                                      return t ? <span className="text-[9px] text-muted-foreground shrink-0">/{t.label}</span> : null;
                                    })()}
                                  </div>
                                </TableCell>
                                {sevenWeekHeaders.map(week => {
                                  const weeklyData = agentData.weeklyScores[week]?.[kpi.id];
                                  let score: number | undefined;
                                  if (weeklyData) {
                                    score = kpi.type === 'percentage' 
                                      ? (weeklyData.count > 0 ? weeklyData.value / weeklyData.count : 0) 
                                      : weeklyData.value;
                                  }
                                  const cellClass = getScoreCellClass(score, kpi);
                                  return (
                                    <TableCell 
                                      key={week} 
                                      className={cn(
                                        "text-center text-[11px] py-1 px-1 border-l bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 tabular-nums font-medium", 
                                        cellClass
                                      )}
                                    >
                                      {score !== undefined 
                                        ? (kpi.type === 'percentage' ? `${score.toFixed(0)}%` : score.toLocaleString()) 
                                        : '-'}
                                    </TableCell>
                                  );
                                })}
                                {timeframe === 'last6weeks' && (
                                  <TableCell
                                    className={cn(
                                      "text-center text-[11px] py-1 px-1 border-l-2 border-primary font-bold tabular-nums",
                                      kpiAgentRanks[kpi.id]?.[agentData.agentId] === 1 ? 'bg-[#9f8f5e] text-[#EFEFEF]' :
                                      kpiAgentRanks[kpi.id]?.[agentData.agentId] === 2 ? 'bg-[#969696] text-[#EFEFEF]' :
                                      kpiAgentRanks[kpi.id]?.[agentData.agentId] === 3 ? 'bg-[#996b4f] text-[#EFEFEF]' :
                                      'bg-primary/5 text-primary'
                                    )}
                                  >
                                    {(() => {
                                      const avg = getSixWeekScore(agentData.weeklyScores, kpi.id, kpi.type, avgWeeks);
                                      return kpi.type === 'percentage' ? `${avg.toFixed(1)}%` : avg.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                    })()}
                                  </TableCell>
                                )}
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
                  {podKpis.map(kpi => {
                    const kpiWeeks = timeframe === 'last6weeks' ? kpiWeekHeaders[kpi.id] || weekHeaders : weekHeaders;
                    const lowerIsBetter = kpi.sortOrder === 'asc';
                    const sortedAgents = kpiSortMode === 'score' && timeframe === 'last6weeks'
                      ? [...processedData].sort((a, b) => {
                          const aScore = getSixWeekScore(a.weeklyScores, kpi.id, kpi.type, kpiWeeks);
                          const bScore = getSixWeekScore(b.weeklyScores, kpi.id, kpi.type, kpiWeeks);
                          return lowerIsBetter ? aScore - bScore : bScore - aScore;
                        })
                      : processedData;
                    return (
                    <Card key={kpi.id} className="border shadow-sm overflow-hidden flex flex-col bg-card/50 min-w-[380px] flex-1 max-w-[600px]">
                      <CardHeader className="bg-gray-200 dark:bg-gray-700 py-3 px-4 border-b">
                        <CardTitle className="text-base flex items-start gap-2">
                          <LayoutGrid className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-800 dark:text-gray-100 leading-tight break-words">{kpi.name}</span>
                            <span className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shrink-0",
                              kpi.sortOrder === 'asc' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                            )}>
                              {kpi.sortOrder === 'asc' ? '↓ Lower' : '↑ Higher'}
                            </span>
                            {(() => {
                              const t = getKpiTarget(kpi);
                              return t ? <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">Target: {t.label}</span> : null;
                            })()}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-100 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <TableHead className="w-[140px] text-xs font-bold uppercase text-gray-700 dark:text-gray-200">Agent</TableHead>
                              {kpiWeeks.map(week => (
                                <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-gray-700 dark:text-gray-200">
                                  {format(endOfWeek(new Date(week), { weekStartsOn }), 'dd/MM')}
                                </TableHead>
                              ))}
                              {timeframe === 'last6weeks' && (
                                <TableHead className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-primary border-l-2 border-primary">AVG</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedAgents.map((agentData, idx) => (
                              <TableRow key={agentData.agentId} className={`h-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                                <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-gray-100/30 dark:bg-gray-700/30 text-gray-800 dark:text-gray-200 truncate max-w-[140px]" title={agentData.agentName}>
                                  {agentData.agentName}
                                </TableCell>
                                {kpiWeeks.map(week => {
                                  const weeklyData = agentData.weeklyScores[week]?.[kpi.id];
                                  let score: number | undefined;
                                  if (weeklyData) {
                                    score = kpi.type === 'percentage' 
                                      ? (weeklyData.count > 0 ? weeklyData.value / weeklyData.count : 0) 
                                      : weeklyData.value;
                                  }
                                  const cellClass = getScoreCellClass(score, kpi);
                                  return (
                                    <TableCell 
                                      key={week} 
                                      className={cn(
                                        "text-center text-[11px] py-1 px-1 border-l bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 tabular-nums font-medium", 
                                        cellClass
                                      )}
                                    >
                                      {score !== undefined 
                                        ? (kpi.type === 'percentage' ? `${score.toFixed(0)}%` : score.toLocaleString()) 
                                        : '-'}
                                    </TableCell>
                                  );
                                })}
                                {timeframe === 'last6weeks' && (
                                  <TableCell
                                    className={cn(
                                      "text-center text-[11px] py-1 px-1 border-l-2 border-primary font-bold tabular-nums",
                                      kpiAgentRanks[kpi.id]?.[agentData.agentId] === 1 ? 'bg-[#9f8f5e] text-[#EFEFEF]' :
                                      kpiAgentRanks[kpi.id]?.[agentData.agentId] === 2 ? 'bg-[#969696] text-[#EFEFEF]' :
                                      kpiAgentRanks[kpi.id]?.[agentData.agentId] === 3 ? 'bg-[#996b4f] text-[#EFEFEF]' :
                                      'bg-primary/5 text-primary'
                                    )}
                                  >
                                    {(() => {
                                      const avg = getSixWeekScore(agentData.weeklyScores, kpi.id, kpi.type, kpiWeeks);
                                      return kpi.type === 'percentage' ? `${avg.toFixed(1)}%` : avg.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                    })()}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="min-w-[150px] sticky left-0 bg-background/95 align-bottom">Agent</TableHead>
                      {weekHeaders.map((week, weekIndex) => (
                        <TableHead key={week} colSpan={podKpis.length} className={`text-center border-l-2 border-primary`}>
                          Week of {week}
                        </TableHead>
                      ))}
                    </TableRow>
                    <TableRow>
                      {weekHeaders.flatMap(week =>
                        podKpis.map((kpi, kpiIndex) => (
                          <TableHead key={`${week}-${kpi.id}`} className="text-center min-w-[120px] border-l">
                            {kpi.name}
                          </TableHead>
                        ))
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedData.map(agentData => (
                      <TableRow key={agentData.agentId}>
                        <TableCell className="font-medium sticky left-0 bg-background/95">{agentData.agentName}</TableCell>
                        {weekHeaders.flatMap((week, weekIndex) =>
                          podKpis.map((kpi, kpiIndex) => {
                            const weeklyData = agentData.weeklyScores[week]?.[kpi.id];
                            let score: number | undefined;

                            if (weeklyData) {
                              if (kpi.type === 'percentage') {
                                  score = weeklyData.count > 0 ? weeklyData.value / weeklyData.count : 0;
                              } else {
                                  score = weeklyData.value;
                              }
                            }
                            const cellClass = getScoreCellClass(score, kpi);

                            return (
                              <TableCell
                                key={`${agentData.agentId}-${week}-${kpi.id}`}
                                className={cn(
                                  'text-center text-foreground font-medium border-l',
                                  weekIndex > 0 && kpiIndex === 0 ? 'border-l-2 border-primary' : '',
                                  cellClass
                                )}
                              >
                                  {score !== undefined ? (kpi.type === 'percentage' ? `${score.toFixed(1)}%` : score.toLocaleString()) : '-'}
                              </TableCell>
                            );
                          })
                        )}
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
    </div>
  );
}
