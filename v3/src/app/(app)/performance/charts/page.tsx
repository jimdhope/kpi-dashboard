'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, format } from 'date-fns';
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
import type { AppPod, AppUser } from '@/lib/contracts';

type AdditionalKpiType = 'number' | 'percentage' | 'scoreOutOf';

interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: AdditionalKpiType;
  maxValue?: number;
  sortOrder?: 'desc' | 'asc';
}

interface AdditionalKpiLog {
  id: string;
  agentId: string;
  podId: string;
  kpiId: string;
  date: string;
  value: number;
}

type Timeframe = 'thisWeek' | 'thisMonth' | 'last6weeks' | 'allTime';

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | undefined;
}

const CHARTS_POD_KEY = 'performanceCharts_selectedPodId';
const CHARTS_KPI_KEY = 'performanceCharts_selectedKpiId';
const CHARTS_AGENT_KEY = 'performanceCharts_selectedAgentId';
const CHARTS_TIMEFRAME_KEY = 'performanceCharts_timeframe';

const LINE_COLORS = [
  "hsl(var(--primary))",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#a4de6c",
  "#d0ed57",
  "#ffc0cb",
];


export default function PerformanceChartsPage() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [selectedKpiId, setSelectedKpiId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        setError("Failed to load KPI logs.");
      }
      setIsLoading(false);
    }
    fetchLogs();
  }, [selectedPodId]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    setSelectedAgentId('all');
    localStorage.setItem(CHARTS_POD_KEY, podId);
    localStorage.removeItem(CHARTS_AGENT_KEY);
  };
  const handleKpiChange = (kpiId: string) => { setSelectedKpiId(kpiId); localStorage.setItem(CHARTS_KPI_KEY, kpiId); };
  const handleAgentChange = (agentId: string) => { setSelectedAgentId(agentId); localStorage.setItem(CHARTS_AGENT_KEY, agentId); };
  const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(CHARTS_TIMEFRAME_KEY, tf); };

  const podAgents = useMemo(() => agents.filter(a => a.roles?.includes('agent')), [agents]);

  const { chartData, tableData, percentageKpis, numberKpis, rightAxisMax } = useMemo(() => {
    const showAllKpis = selectedKpiId === 'all';
    if ((!selectedKpiId || selectedKpiId === '') || !kpis.length) return { chartData: [], tableData: [], percentageKpis: [], numberKpis: [], rightAxisMax: 100 };
    
    let kpisToProcess = showAllKpis ? kpis : kpis.filter(k => k.id === selectedKpiId);
    if (kpisToProcess.length === 0) return { chartData: [], tableData: [], percentageKpis: [], numberKpis: [], rightAxisMax: 100 };

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
            if (logs.length === 0) return { chartData: [], tableData: [], percentageKpis: [], numberKpis: [], rightAxisMax: 100 };
            const sortedLogs = [...logs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            startDate = new Date(sortedLogs[0].date);
            endDate = new Date(sortedLogs[sortedLogs.length - 1].date);
            break;
    }
    
    const relevantLogs = logs.filter(log => {
      const logDate = new Date(log.date);
      const agentMatch = selectedAgentId === 'all' || log.agentId === selectedAgentId;
      const kpiMatch = showAllKpis || log.kpiId === selectedKpiId;
      return agentMatch && kpiMatch && logDate >= startDate && logDate <= endDate;
    });

    const dataByDate: Record<string, Record<string, string | number>> = {};

    relevantLogs.forEach(log => {
        const dateStr = format(new Date(log.date), 'yyyy-MM-dd');
        const kpiInfo = kpis.find(k => k.id === log.kpiId);
        if (!kpiInfo) return;

        if (!dataByDate[dateStr]) {
            dataByDate[dateStr] = { date: format(new Date(log.date), 'MMM dd') };
        }

        const valueKey = kpiInfo.name;
        const countKey = `${kpiInfo.name}_count`;
        
        dataByDate[dateStr][valueKey] = (Number(dataByDate[dateStr][valueKey]) || 0) + Number(log.value);
        dataByDate[dateStr][countKey] = (Number(dataByDate[dateStr][countKey]) || 0) + 1;
    });

    const finalChartData = Object.values(dataByDate).map(dataPoint => {
        const processedDataPoint: Record<string, string | number> = { date: dataPoint.date as string };
        kpisToProcess.forEach(kpiInfo => {
            const valueKey = kpiInfo.name;
            const countKey = `${kpiInfo.name}_count`;
            const totalValue = Number(dataPoint[valueKey]) || 0;
            const count = Number(dataPoint[countKey]) || 0;

            if (totalValue !== undefined && count > 0) {
                 let finalValue: number;
                 if (selectedAgentId === 'all') {
                    finalValue = totalValue / count;
                } else {
                    finalValue = totalValue;
                }
                 processedDataPoint[valueKey] = parseFloat(finalValue.toFixed(2));
            }
        });
        return processedDataPoint as unknown as ChartDataPoint;
    }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const finalPercentageKpis = kpisToProcess.filter(k => k.type === 'percentage');
    const finalNumberKpis = kpisToProcess.filter(k => k.type !== 'percentage');

    let maxRightAxisValue = 0;
    finalChartData.forEach(dataPoint => {
        finalNumberKpis.forEach(kpi => {
            const value = dataPoint[kpi.name];
            if (typeof value === 'number' && value > maxRightAxisValue) {
                maxRightAxisValue = value;
            }
        });
    });
    const finalRightAxisMax = Math.ceil(maxRightAxisValue);

    return { chartData: finalChartData, tableData: relevantLogs, percentageKpis: finalPercentageKpis, numberKpis: finalNumberKpis, rightAxisMax: finalRightAxisMax > 0 ? finalRightAxisMax : 100 };

  }, [selectedPodId, selectedKpiId, selectedAgentId, timeframe, logs, kpis, podAgents]);


  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Chart Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="grid gap-2">
              <Label>Pod</Label>
              <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Select Pod" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pods</SelectItem>
                  {pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Agent</Label>
              <Select onValueChange={handleAgentChange} value={selectedAgentId} disabled={isLoading || !selectedPodId || selectedPodId === 'all'}>
                <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents (Aggregated)</SelectItem>
                  {podAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>KPI</Label>
              <Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Select KPI" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All KPIs</SelectItem>
                  {kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.initials} {k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Timeframe</Label>
              <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}>
                <SelectTrigger><SelectValue placeholder="Select Timeframe" /></SelectTrigger>
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

      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" /> KPI Performance Chart</CardTitle>
          <CardDescription>
            Visualizing <span className="font-semibold">{selectedKpiId === 'all' ? 'All KPIs' : kpis.find(k=>k.id === selectedKpiId)?.name}</span> for <span className="font-semibold">{selectedAgentId === 'all' ? 'All Agents' : agents.find(a=>a.id===selectedAgentId)?.name}</span>
            {selectedPodId !== 'all' && ` in ${pods.find(p=>p.id===selectedPodId)?.name || '...'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : !selectedKpiId ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground"><AlertCircle className="mr-2"/>Please select a KPI to view the chart.</div>
          ) : chartData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground"><AlertCircle className="mr-2"/>No data available for the selected filters.</div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <RechartsLineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="left" stroke={LINE_COLORS[1]} fontSize={12} domain={[0, 100]} tickFormatter={(value) => `${value}%`} hide={percentageKpis.length === 0} />
                <YAxis yAxisId="right" orientation="right" stroke={LINE_COLORS[0]} fontSize={12} hide={numberKpis.length === 0} domain={[0, rightAxisMax]} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                <Legend />
                {percentageKpis.map((kpi, index) => (
                   <Line 
                     key={`pct-${kpi.id}`}
                     yAxisId="left"
                     type="monotone" 
                     dataKey={kpi.name} 
                     stroke={LINE_COLORS[(index + numberKpis.length) % LINE_COLORS.length]}
                     strokeWidth={2} 
                     dot={{ r: 4 }} 
                     activeDot={{ r: 6 }} 
                   />
                ))}
                {numberKpis.map((kpi, index) => (
                   <Line 
                     key={`num-${kpi.id}`}
                     yAxisId="right"
                     type="monotone" 
                     dataKey={kpi.name} 
                     stroke={LINE_COLORS[index % LINE_COLORS.length]} 
                     strokeWidth={2} 
                     dot={{ r: 4 }} 
                     activeDot={{ r: 6 }} 
                   />
                ))}
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
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Agent</TableHead><TableHead>KPI</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)
                    ) : tableData.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                    ) : (
                        tableData.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                <TableCell>{agents.find(a => a.id === log.agentId)?.name || 'Unknown'}</TableCell>
                                <TableCell>{kpis.find(k => k.id === log.kpiId)?.name || 'Unknown'}</TableCell>
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
