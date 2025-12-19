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
  getDate,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  subWeeks,
  addWeeks, // Import addWeeks
} from 'date-fns';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangePicker } from '@/components/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Filter, BarChartHorizontal } from 'lucide-react';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';

const KPI_BREAKDOWN_POD_KEY = 'kpiBreakdown_selectedPodId';
const KPI_BREAKDOWN_KPI_KEY = 'kpiBreakdown_selectedKpiId';

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

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfWeek(subWeeks(new Date(), 5), { weekStartsOn: 1 }), // Default to start of week 6 weeks ago, Monday start
    to: endOfWeek(new Date(), { weekStartsOn: 1 }), // Default to end of current week, Sunday end
  });

  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching ---

  useEffect(() => {
    const savedPodId = localStorage.getItem(KPI_BREAKDOWN_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedKpiId = localStorage.getItem(KPI_BREAKDOWN_KPI_KEY);
    if (savedKpiId) setSelectedKpiId(savedKpiId);
  }, []);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(KPI_BREAKDOWN_POD_KEY, podId);
  };
  const handleKpiChange = (kpiId: string) => {
    setSelectedKpiId(kpiId);
    localStorage.setItem(KPI_BREAKDOWN_KPI_KEY, kpiId);
  };

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

  useEffect(() => {
    if (!selectedPodId || !selectedKpiId || !dateRange?.from || !dateRange?.to) {
      setLogs([]);
      return;
    }
    setIsLoading(true);
    const logsQuery = query(
      collection(db, 'additionalKpiLogs'),
      where('podId', '==', selectedPodId),
      where('kpiId', '==', selectedKpiId),
      where('date', '>=', Timestamp.fromDate(dateRange.from)),
      where('date', '<=', Timestamp.fromDate(dateRange.to)),
    );
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
    if (!dateRange?.from || !dateRange.to || logs.length === 0) return [];
    
    const podAgents = agents.filter(a => a.podId === selectedPodId && a.roles?.includes('agent'));
    if (podAgents.length === 0) return [];

    const weeks: WeeklyScores[] = [];
    let currentWeekStart = startOfWeek(dateRange.from, { weekStartsOn: 1 }); // Monday

    while (currentWeekStart <= dateRange.to) {
      const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

      const logsInWeek = logs.filter(log => isWithinInterval(log.date.toDate(), { start: currentWeekStart, end: currentWeekEnd }));

      const agentData = podAgents.map(agent => {
        const dailyScores: (number | null)[] = daysInWeek.map(day => {
          const logForDay = logsInWeek.find(log => log.agentId === agent.id && isSameDay(log.date.toDate(), day));
          return logForDay ? logForDay.value : null;
        });
        const total = dailyScores.reduce((sum, score) => sum + (score || 0), 0);
        return { agentId: agent.id!, agentName: agent.name, dailyScores, total };
      });

      weeks.push({
        weekOf: format(currentWeekStart, 'do MMMM yyyy'),
        days: daysInWeek,
        agentData: agentData.sort((a,b) => b.total - a.total), // Sort agents by total score for the week
      });
      
      // Move to the next week
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }
    return weeks;
  }, [logs, agents, selectedPodId, dateRange]);

  const selectedKpi = kpis.find(k => k.id === selectedKpiId);

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
              <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}><SelectTrigger id="pod-select"><SelectValue placeholder="Select Pod" /></SelectTrigger><SelectContent>{pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kpi-select">KPI</Label>
              <Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}><SelectTrigger id="kpi-select"><SelectValue placeholder="Select KPI" /></SelectTrigger><SelectContent>{kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.emoji} {k.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date-range">Date Range</Label>
              <DateRangePicker id="date-range" date={dateRange} setDate={setDateRange} disabled={isLoading} />
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
