
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
import { Filter, BarChartHorizontal } from 'lucide-react';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';

const KPI_BREAKDOWN_POD_KEY = 'kpiBreakdown_selectedPodId';
const KPI_BREAKDOWN_KPI_KEY = 'kpiBreakdown_selectedKpiId';
const KPI_BREAKDOWN_TIMEFRAME_KEY = 'kpiBreakdown_timeframe';
const KPI_BREAKDOWN_WEEKSTART_KEY = 'kpiBreakdown_weekStartsOn';

type Timeframe = 'last6weeks' | 'thisWeek' | 'thisMonth' | 'allTime';
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon, ..., 6=Sat

interface WeeklyScores {
  weekOf: string;
  days: Date[];
  agentData: Array<{
    agentId: string;
    agentName: string;
    dailyScores: (number | null)[];
    total: number;
  }>;
}

export default function KpiBreakdownPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedKpiId, setSelectedKpiId] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartDay>(4); // Default to Thursday

  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching ---

  useEffect(() => {
    const savedPodId = localStorage.getItem(KPI_BREAKDOWN_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedKpiId = localStorage.getItem(KPI_BREAKDOWN_KPI_KEY);
    if (savedKpiId) setSelectedKpiId(savedKpiId);
    const savedTimeframe = localStorage.getItem(KPI_BREAKDOWN_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
    const savedWeekStart = localStorage.getItem(KPI_BREAKDOWN_WEEKSTART_KEY);
    if (savedWeekStart) setWeekStartsOn(parseInt(savedWeekStart, 10) as WeekStartDay);
  }, []);

  const handlePodChange = (podId: string) => { setSelectedPodId(podId); localStorage.setItem(KPI_BREAKDOWN_POD_KEY, podId); };
  const handleKpiChange = (kpiId: string) => { setSelectedKpiId(kpiId); localStorage.setItem(KPI_BREAKDOWN_KPI_KEY, kpiId); };
  const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(KPI_BREAKDOWN_TIMEFRAME_KEY, tf); };
  const handleWeekStartChange = (day: string) => { setWeekStartsOn(parseInt(day, 10) as WeekStartDay); localStorage.setItem(KPI_BREAKDOWN_WEEKSTART_KEY, day); };


  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), (snap) => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('name')), (snap) => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
      setIsLoading(false);
    }));
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (timeframe) {
      case 'thisWeek':
        return { from: startOfWeek(now, { weekStartsOn }), to: endOfWeek(now, { weekStartsOn }) };
      case 'thisMonth':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last6weeks':
        return { from: startOfWeek(subWeeks(now, 5), { weekStartsOn }), to: endOfWeek(now, { weekStartsOn }) };
      case 'allTime':
        return { from: undefined, to: undefined };
    }
  }, [timeframe, weekStartsOn]);

  useEffect(() => {
    if (!selectedPodId || !selectedKpiId) {
      setLogs([]);
      return;
    }
    setIsLoading(true);
    let logsQuery = query(
      collection(db, 'additionalKpiLogs'),
      where('podId', '==', selectedPodId),
      where('kpiId', '==', selectedKpiId)
    );

    if (dateRange.from) {
        logsQuery = query(logsQuery, where('date', '>=', Timestamp.fromDate(dateRange.from)));
    }
    if (dateRange.to) {
        logsQuery = query(logsQuery, where('date', '<=', Timestamp.fromDate(dateRange.to)));
    }

    const unsubscribe = onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog)));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching logs:", err);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [selectedPodId, selectedKpiId, dateRange]);

  // --- Data Processing ---

  const weeklyData = useMemo((): WeeklyScores[] => {
    if (!dateRange || !dateRange.from || !dateRange.to || logs.length === 0) return [];
    
    const podAgents = agents.filter(a => a.podId === selectedPodId && a.roles?.includes('agent'));
    if (podAgents.length === 0) return [];

    const weeks: WeeklyScores[] = [];
    let currentDay = dateRange.from;

    while (currentDay <= dateRange.to) {
        const weekStart = startOfWeek(currentDay, { weekStartsOn });
        const weekEnd = endOfWeek(currentDay, { weekStartsOn });
        const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
        
        const logsInWeek = logs.filter(log => isWithinInterval(log.date.toDate(), { start: weekStart, end: weekEnd }));
        
        const agentData = podAgents.map(agent => {
            const dailyScores: (number | null)[] = daysInWeek.map(day => {
              const logForDay = logsInWeek.find(log => log.agentId === agent.id && isSameDay(log.date.toDate(), day));
              return logForDay ? logForDay.value : null;
            });
            const total = dailyScores.reduce((sum, score) => sum + (score || 0), 0);
            return { agentId: agent.id!, agentName: agent.name, dailyScores, total };
        });

        weeks.push({
            weekOf: format(weekStart, 'do MMMM yyyy'),
            days: daysInWeek,
            agentData: agentData.sort((a,b) => b.total - a.total),
        });

        currentDay = new Date(weekEnd.setDate(weekEnd.getDate() + 1));
    }
    return weeks;
  }, [logs, agents, selectedPodId, dateRange, weekStartsOn]);

  const selectedKpi = kpis.find(k => k.id === selectedKpiId);
  const weekDayOptions = [
    { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> KPI Breakdown Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}><SelectTrigger id="pod-select"><SelectValue placeholder="Select Pod" /></SelectTrigger><SelectContent>{pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kpi-select">KPI</Label>
              <Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}><SelectTrigger id="kpi-select"><SelectValue placeholder="Select KPI" /></SelectTrigger><SelectContent>{kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.emoji} {k.name}</SelectItem>)}</SelectContent></Select>
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

      {!selectedPodId || !selectedKpiId ? (
        <p className="text-muted-foreground text-center py-6">Please select a pod and a KPI to view the breakdown.</p>
      ) : isLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : weeklyData.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">No scores logged for the selected KPI and date range.</p>
      ) : (
        <div className="space-y-8">
          {weeklyData.map((week) => (
            <Card key={week.weekOf} className="frosted-glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChartHorizontal className="h-5 w-5" /> Week of {week.weekOf}</CardTitle>
                <CardDescription>Breakdown for KPI: {selectedKpi?.emoji} {selectedKpi?.name}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px] sticky left-0 bg-background/95">Agent</TableHead>
                      {week.days.map(day => (
                        <TableHead key={day.toISOString()} className="text-center w-[80px]">
                          {format(day, 'E')}
                          <br/>
                          {format(day, 'd')}
                        </TableHead>
                      ))}
                      <TableHead className="text-right font-bold w-[100px]">Weekly Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.agentData.map(agent => (
                      <TableRow key={agent.agentId}>
                        <TableCell className="font-medium sticky left-0 bg-background/95">{agent.agentName}</TableCell>
                        {agent.dailyScores.map((score, index) => (
                          <TableCell key={index} className="text-center text-muted-foreground">
                            {score === null ? '-' : score.toLocaleString()}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold text-primary">{agent.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
