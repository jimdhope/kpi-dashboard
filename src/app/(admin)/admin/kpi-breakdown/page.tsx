'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';
import { cn } from '@/lib/utils';

const KPI_BREAKDOWN_POD_KEY = 'kpiBreakdown_selectedPodId';
const KPI_BREAKDOWN_TIMEFRAME_KEY = 'kpiBreakdown_timeframe';
const KPI_BREAKDOWN_WEEKSTART_KEY = 'kpiBreakdown_weekStartsOn';
const KPI_BREAKDOWN_VIEWMODE_KEY = 'kpiBreakdown_viewMode';

type Timeframe = 'last6weeks' | 'thisWeek' | 'thisMonth' | 'allTime';
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon, ..., 6=Sat
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
  const [pods, setPods] = useState<Pod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartDay>(4); // Default to Thursday
  const [viewMode, setViewMode] = useState<ViewMode>('agent');

  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching ---

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
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), (snap) => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('name')), (snap) => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }));

    Promise.all([
        getDocs(query(collection(db, 'pods'))),
        getDocs(query(collection(db, 'additionalKpis'))),
        getDocs(query(collection(db, 'users'))),
    ]).then(() => setIsLoading(false));


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
    }, (err) => {
      console.error("Error fetching logs:", err);
      setIsLoading(false);
    });
    return () => unsubscribe();
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
      const logDate = log.date.toDate();
      return logDate >= startDate && logDate <= endDate;
    });
  }, [logs, timeframe, weekStartsOn]);
  

  // --- Data Processing ---
  const { processedData, weekHeaders, podKpis } = useMemo(() => {
    if (filteredLogs.length === 0 || kpis.length === 0) {
      return { processedData: [], weekHeaders: [], podKpis: [] };
    }
    
    const podAgents = selectedPodId === 'all'
      ? agents.filter(a => a.roles?.includes('agent'))
      : agents.filter(a => a.podId === selectedPodId && a.roles?.includes('agent'));
    
    if (podAgents.length === 0) {
        return { processedData: [], weekHeaders: [], podKpis: [] };
    }
    
    const podKpiIds = new Set(filteredLogs.map(log => log.kpiId));
    const podKpis = kpis.filter(kpi => podKpiIds.has(kpi.id)).sort((a,b) => a.name.localeCompare(b.name));

    const agentData: AgentWeeklyData[] = podAgents.map(agent => ({
        agentId: agent.id!,
        agentName: agent.name,
        weeklyScores: {}
    }));

    const weeks = new Set<string>();

    filteredLogs.forEach(log => {
        const weekStart = startOfWeek(log.date.toDate(), { weekStartsOn });
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
      return ''; // No score or criteria, no special class
    }
  
    const passValue = kpi.passFailValue;
    if (passValue === undefined || passValue === null) {
      return ''; // No value to compare against
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
              <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}><SelectTrigger id="timeframe-select"><SelectValue placeholder="Select Timeframe" /></SelectTrigger><SelectContent><SelectItem value="thisWeek">This Week</SelectItem><SelectItem value="thisMonth">This Month</SelectItem><SelectItem value="last6weeks">Last 6 Weeks</SelectItem><SelectItem value="allTime">All Time</SelectItem></SelectContent></Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="weekstart-select">Week Starts On</Label>
              <Select onValueChange={handleWeekStartChange} value={String(weekStartsOn)} disabled={isLoading}><SelectTrigger id="weekstart-select"><SelectValue placeholder="Select Day" /></SelectTrigger><SelectContent>{weekDayOptions.map(day => <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>)}</SelectContent></Select>
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
                /* --- Agent Card View --- */
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {processedData.map(agentData => (
                    <Card key={agentData.agentId} className="border shadow-sm overflow-hidden flex flex-col bg-card/50">
                      <CardHeader className="bg-muted/20 py-3 px-4 border-b">
                        <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> {agentData.agentName}</CardTitle>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableHead className="w-[140px] text-xs font-bold uppercase">KPI</TableHead>
                              {weekHeaders.map(week => (
                                <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase">
                                  {format(new Date(week), 'dd/MM')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {podKpis.map(kpi => (
                              <TableRow key={kpi.id} className="h-8 hover:bg-accent/5 transition-colors">
                                <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-muted/5 truncate max-w-[140px]" title={kpi.name}>
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
                                        "text-center text-[11px] py-1 px-1 border-l tabular-nums font-medium", 
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
                /* --- KPI Card View --- */
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {podKpis.map(kpi => (
                    <Card key={kpi.id} className="border shadow-sm overflow-hidden flex flex-col bg-card/50">
                      <CardHeader className="bg-muted/20 py-3 px-4 border-b">
                        <CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> {kpi.name}</CardTitle>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableHead className="w-[140px] text-xs font-bold uppercase">Agent</TableHead>
                              {weekHeaders.map(week => (
                                <TableHead key={week} className="text-center text-[10px] px-1 font-bold whitespace-nowrap uppercase">
                                  {format(new Date(week), 'dd/MM')}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {processedData.map(agentData => (
                              <TableRow key={agentData.agentId} className="h-8 hover:bg-accent/5 transition-colors">
                                <TableCell className="text-[11px] font-semibold py-1 px-3 border-r bg-muted/5 truncate max-w-[140px]" title={agentData.agentName}>
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
                                        "text-center text-[11px] py-1 px-1 border-l tabular-nums font-medium", 
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
              /* --- Traditional Table View for Short Frames --- */
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