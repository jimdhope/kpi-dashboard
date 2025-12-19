
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Filter, AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from 'recharts';

import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';

type Timeframe = 'thisWeek' | 'thisMonth' | 'last6weeks' | 'allTime';

interface ChartDataPoint {
  date: string; // Formatted date string e.g., 'MMM dd'
  [key: string]: string | number | undefined; // Can have multiple KPI scores
}

const CHARTS_POD_KEY = 'performanceCharts_selectedPodId';
const CHARTS_KPI_KEY = 'performanceCharts_selectedKpiId';
const CHARTS_AGENT_KEY = 'performanceCharts_selectedAgentId';
const CHARTS_TIMEFRAME_KEY = 'performanceCharts_timeframe';


export default function PerformanceChartsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedKpiId, setSelectedKpiId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all'); // 'all' or a user ID
  const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    // Load saved filters from localStorage
    const savedPodId = localStorage.getItem(CHARTS_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedKpiId = localStorage.getItem(CHARTS_KPI_KEY);
    if (savedKpiId) setSelectedKpiId(savedKpiId);
    const savedAgentId = localStorage.getItem(CHARTS_AGENT_KEY);
    if (savedAgentId) setSelectedAgentId(savedAgentId);
    const savedTimeframe = localStorage.getItem(CHARTS_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes = [
      onSnapshot(query(collection(db, 'pods'), orderBy('name')), snap => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))),
      onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), snap => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))),
      onSnapshot(query(collection(db, 'users'), orderBy('name')), snap => setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)))),
    ];
    Promise.all(unsubscribes.map(() => new Promise(res => setTimeout(res, 0)))).finally(() => setIsLoading(false)); // A bit of a hack to wait for initial loads
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  useEffect(() => {
    if (!selectedPodId) {
      setLogs([]);
      return;
    }
    setIsLoading(true);
    const logsQuery = query(collection(db, 'additionalKpiLogs'), where('podId', '==', selectedPodId));
    const unsubscribe = onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog)));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching logs:", err);
      setError("Failed to load KPI logs.");
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [selectedPodId]);


  // --- Event Handlers for Filters ---
  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    setSelectedAgentId('all'); // Reset agent when pod changes
    localStorage.setItem(CHARTS_POD_KEY, podId);
    localStorage.removeItem(CHARTS_AGENT_KEY);
  };
  const handleKpiChange = (kpiId: string) => { setSelectedKpiId(kpiId); localStorage.setItem(CHARTS_KPI_KEY, kpiId); };
  const handleAgentChange = (agentId: string) => { setSelectedAgentId(agentId); localStorage.setItem(CHARTS_AGENT_KEY, agentId); };
  const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(CHARTS_TIMEFRAME_KEY, tf); };

  // --- Memoized Data Processing ---

  const podAgents = useMemo(() => agents.filter(a => a.podId === selectedPodId && a.roles?.includes('agent')), [agents, selectedPodId]);

  const { chartData, tableData, selectedKpiName } = useMemo(() => {
    if (!selectedKpiId || !kpis.length) return { chartData: [], tableData: [], selectedKpiName: 'Selected KPI' };
    
    const kpi = kpis.find(k => k.id === selectedKpiId);
    if (!kpi) return { chartData: [], tableData: [], selectedKpiName: 'Selected KPI' };

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timeframe) {
        case 'thisWeek':
            startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
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
            // Find earliest and latest log dates
            if (logs.length === 0) return { chartData: [], tableData: [], selectedKpiName: kpi.name };
            const sortedLogs = [...logs].sort((a,b) => a.date.toDate().getTime() - b.date.toDate().getTime());
            startDate = sortedLogs[0].date.toDate();
            endDate = sortedLogs[sortedLogs.length - 1].date.toDate();
            break;
    }
    
    const relevantLogs = logs.filter(log => {
      const logDate = log.date.toDate();
      const agentMatch = selectedAgentId === 'all' || log.agentId === selectedAgentId;
      const kpiMatch = log.kpiId === selectedKpiId;
      return agentMatch && kpiMatch && logDate >= startOfDay(startDate) && logDate <= endOfDay(endDate);
    });

    // Create a map to aggregate scores by date
    const scoresByDate: Record<string, number> = {};
    const countsByDate: Record<string, number> = {};
    const datesWithData = new Set<string>();

    relevantLogs.forEach(log => {
        const dateStr = format(log.date.toDate(), 'yyyy-MM-dd');
        datesWithData.add(dateStr);
        scoresByDate[dateStr] = (scoresByDate[dateStr] || 0) + log.value;
        countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    });

    const finalChartData: ChartDataPoint[] = Array.from(datesWithData).sort().map(dateStr => {
        const date = new Date(dateStr);
        const value = scoresByDate[dateStr] || 0;
        const count = countsByDate[dateStr] || 0;

        let score = 0;
        if (kpi.type === 'percentage' && count > 0) {
            score = value / count;
        } else if (selectedAgentId !== 'all') { // number, scoreOutOf for single agent
            score = value;
        } else { // 'all' agents, aggregate for number types
            score = value;
        }
        
        return {
            date: format(date, 'MMM dd'),
            [kpi.name]: score,
        };
    });

    return { chartData: finalChartData, tableData: relevantLogs, selectedKpiName: kpi.name };

  }, [selectedPodId, selectedKpiId, selectedAgentId, timeframe, logs, kpis, podAgents]);


  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Chart Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="grid gap-2"><Label>Pod</Label><Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}><SelectTrigger><SelectValue placeholder="Select Pod" /></SelectTrigger><SelectContent>{pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Agent</Label><Select onValueChange={handleAgentChange} value={selectedAgentId} disabled={isLoading || !selectedPodId}><SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger><SelectContent><SelectItem value="all">All Agents (Aggregated)</SelectItem>{podAgents.map(a => <SelectItem key={a.id!} value={a.id!}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>KPI</Label><Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}><SelectTrigger><SelectValue placeholder="Select KPI" /></SelectTrigger><SelectContent>{kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.initials} {k.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Timeframe</Label><Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}><SelectTrigger><SelectValue placeholder="Select Timeframe" /></SelectTrigger><SelectContent><SelectItem value="thisWeek">This Week</SelectItem><SelectItem value="thisMonth">This Month</SelectItem><SelectItem value="last6weeks">Last 6 Weeks</SelectItem><SelectItem value="allTime">All Time</SelectItem></SelectContent></Select></div>
          </div>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> KPI Performance Chart</CardTitle>
          <CardDescription>
            Visualizing <span className="font-semibold">{selectedKpiName}</span> for <span className="font-semibold">{selectedAgentId === 'all' ? 'All Agents' : agents.find(a=>a.id===selectedAgentId)?.name}</span> in <span className="font-semibold">{pods.find(p=>p.id===selectedPodId)?.name || '...'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : !selectedPodId || !selectedKpiId ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground"><AlertCircle className="mr-2"/>Please select a Pod and KPI to view the chart.</div>
          ) : chartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground"><AlertCircle className="mr-2"/>No data available for the selected filters.</div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <RechartsLineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                <Legend />
                <Line type="monotone" dataKey={selectedKpiName} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </RechartsLineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      
      <Card className="frosted-glass">
        <CardHeader><CardTitle>Chart Data</CardTitle></CardHeader>
        <CardContent>
           <div className="overflow-x-auto max-h-80">
            <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Agent</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)
                    ) : tableData.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                    ) : (
                        tableData.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{format(log.date.toDate(), 'PPP')}</TableCell>
                                <TableCell>{agents.find(a => a.id === log.agentId)?.name || 'Unknown'}</TableCell>
                                <TableCell>{log.value}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
