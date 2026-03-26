'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  subWeeks,
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

interface AdditionalKpiLog {
  id: string;
  agentId: string;
  podId: string;
  kpiId: string;
  date: string;
  value: number;
}

const KPI_BREAKDOWN_POD_KEY = 'kpiBreakdown_selectedPodId';
const KPI_BREAKDOWN_TIMEFRAME_KEY = 'kpiBreakdown_timeframe';
const KPI_BREAKDOWN_WEEKSTART_KEY = 'kpiBreakdown_weekStartsOn';
const KPI_BREAKDOWN_VIEWMODE_KEY = 'kpiBreakdown_viewMode';

type Timeframe = 'last6weeks' | 'thisWeek' | 'thisMonth' | 'allTime';
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ViewMode = 'agent' | 'kpi';

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
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartDay>(4);
  const [viewMode, setViewMode] = useState<ViewMode>('agent');

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedPodId = localStorage.getItem(KPI_BREAKDOWN_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedTimeframe = localStorage.getItem(KPI_BREAKDOWN_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
    const savedWeekStart = localStorage.getItem(KPI_BREAKDOWN_WEEKSTART_KEY);
    if (savedWeekStart) setWeekStartsOn(parseInt(savedWeekStart, 10) as WeekStartDay);
    const savedViewMode = localStorage.getItem(KPI_BREAKDOWN_VIEWMODE_KEY) as ViewMode | null;
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const handlePodChange = (podId: string) => { setSelectedPodId(podId); localStorage.setItem(KPI_BREAKDOWN_POD_KEY, podId); };
  const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(KPI_BREAKDOWN_TIMEFRAME_KEY, tf); };
  const handleWeekStartChange = (day: string) => { setWeekStartsOn(parseInt(day, 10) as WeekStartDay); localStorage.setItem(KPI_BREAKDOWN_WEEKSTART_KEY, day); };
  const handleViewModeChange = (mode: string) => { setViewMode(mode as ViewMode); localStorage.setItem(KPI_BREAKDOWN_VIEWMODE_KEY, mode); };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [podsRes, kpisRes, usersRes] = await Promise.all([
          fetch('/api/pods'),
          fetch('/api/kpis'),
          fetch('/api/users'),
        ]);
        
        if (podsRes.ok) {
          const podsData = await podsRes.json();
          setPods(podsData.pods || []);
        }
        if (kpisRes.ok) {
          const kpisData = await kpisRes.json();
          setKpis(kpisData.kpis || []);
        }
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAgents(usersData.users || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);
  
  useEffect(() => {
    async function fetchLogs() {
      setIsLoading(true);
      try {
        let url = '/api/performance/logs';
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
    if (timeframe === 'allTime') {
      return logs;
    }
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    
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
        startDate = startOfWeek(subWeeks(now, 5), { weekStartsOn });
        endDate = endOfWeek(now, { weekStartsOn });
        break;
    }

    return logs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= startDate && logDate <= endDate;
    });
  }, [logs, timeframe, weekStartsOn]);
  

  const { processedData, weekHeaders, podKpis } = useMemo(() => {
    if (filteredLogs.length === 0 || kpis.length === 0) {
      return { processedData: [], weekHeaders: [], podKpis: [] };
    }
    
    const podAgents = selectedPodId === 'all'
      ? agents.filter(a => a.roles?.includes('agent'))
      : agents.filter(a => a.roles?.includes('agent'));
    
    if (podAgents.length === 0) {
        return { processedData: [], weekHeaders: [], podKpis: [] };
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
        const weekStart = startOfWeek(new Date(log.date), { weekStartsOn });
        const weekOf = format(weekStart, 'MMM dd, yyyy');
        weeks.add(weekOf);

        const agent = agentData.find(a => a.agentId === log.agentId);
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
    
    return { processedData: agentData.sort((a, b) => a.agentName.localeCompare(b.agentName)), weekHeaders, podKpis };

  }, [filteredLogs, agents, selectedPodId, kpis, weekStartsOn]);

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
                </SelectContent>
              </Select>
            </div>
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
                              {weekHeaders.map(week => (
                                <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-gray-700 dark:text-gray-200">
                                  {format(new Date(week), 'dd/MM')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {podKpis.map((kpi, idx) => (
                              <TableRow key={kpi.id} className={`h-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                                <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-gray-100/30 dark:bg-gray-700/30 text-gray-800 dark:text-gray-200 truncate max-w-[140px]" title={kpi.name}>
                                  {kpi.name}
                                </TableCell>
                                {weekHeaders.map(week => {
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
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
                  {podKpis.map(kpi => (
                    <Card key={kpi.id} className="border shadow-sm overflow-hidden flex flex-col bg-card/50 min-w-[380px] flex-1 max-w-[600px]">
                      <CardHeader className="bg-gray-200 dark:bg-gray-700 py-3 px-4 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4 text-blue-600 dark:text-blue-400" /> 
                          <span className="text-gray-800 dark:text-gray-100">{kpi.name}</span>
                        </CardTitle>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-100 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <TableHead className="w-[140px] text-xs font-bold uppercase text-gray-700 dark:text-gray-200">Agent</TableHead>
                              {weekHeaders.map(week => (
                                <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase text-gray-700 dark:text-gray-200">
                                  {format(new Date(week), 'dd/MM')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {processedData.map((agentData, idx) => (
                              <TableRow key={agentData.agentId} className={`h-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                                <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-gray-100/30 dark:bg-gray-700/30 text-gray-800 dark:text-gray-200 truncate max-w-[140px]" title={agentData.agentName}>
                                  {agentData.agentName}
                                </TableCell>
                                {weekHeaders.map(week => {
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
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  ))}
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
