
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfWeek, subWeeks, startOfMonth, endOfMonth, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Filter, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart as RechartsLineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';

interface PerformanceChartsWidgetProps {
    currentUser: AppUser;
}

type Timeframe = 'thisWeek' | 'thisMonth' | 'last6weeks' | 'allTime';
type DataScope = 'me' | 'pod' | 'all';

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | undefined;
}

const AGENT_WIDGET_CHARTS_SCOPE_KEY = 'agentWidget_charts_scope';
const AGENT_WIDGET_CHARTS_TIMEFRAME_KEY = 'agentWidget_charts_timeframe';

const LINE_COLORS = ["hsl(var(--primary))", "#82ca9d", "#ffc658", "#ff7300"];

export function PerformanceChartsWidget({ currentUser }: PerformanceChartsWidgetProps) {
    const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
    const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);
    const [dataScope, setDataScope] = useState<DataScope>('me');
    const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedScope = localStorage.getItem(AGENT_WIDGET_CHARTS_SCOPE_KEY) as DataScope | null;
        if (savedScope) setDataScope(savedScope);
        const savedTimeframe = localStorage.getItem(AGENT_WIDGET_CHARTS_TIMEFRAME_KEY) as Timeframe | null;
        if (savedTimeframe) setTimeframe(savedTimeframe);
    }, []);

    const handleScopeChange = (scope: string) => { setDataScope(scope as DataScope); localStorage.setItem(AGENT_WIDGET_CHARTS_SCOPE_KEY, scope); };
    const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(AGENT_WIDGET_CHARTS_TIMEFRAME_KEY, tf); };

    useEffect(() => {
        setIsLoading(true);
        const kpiUnsub = onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), snap => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi))));
        
        let logsQuery;
        if (dataScope === 'me') {
            logsQuery = query(collection(db, 'additionalKpiLogs'), where('agentId', '==', currentUser.id));
        } else if (dataScope === 'pod') {
            logsQuery = query(collection(db, 'additionalKpiLogs'), where('podId', '==', currentUser.podId));
        } else {
            logsQuery = query(collection(db, 'additionalKpiLogs'));
        }

        const logsUnsub = onSnapshot(logsQuery, snap => {
            setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog)));
            setIsLoading(false);
        }, err => {
            console.error(err);
            setIsLoading(false);
        });

        return () => { kpiUnsub(); logsUnsub(); };
    }, [dataScope, currentUser]);

    const { chartData, percentageKpis, numberKpis } = useMemo(() => {
        if (!logs.length || !kpis.length) return { chartData: [], percentageKpis: [], numberKpis: [] };

        let startDate: Date;
        const now = new Date();
        switch (timeframe) {
            case 'thisWeek': startDate = startOfWeek(now, { weekStartsOn: 1 }); break;
            case 'thisMonth': startDate = startOfMonth(now); break;
            case 'last6weeks': default: startDate = startOfWeek(subWeeks(now, 5), { weekStartsOn: 1 }); break;
            case 'allTime': startDate = new Date(0); break;
        }

        const relevantLogs = logs.filter(log => log.date.toDate() >= startDate);
        const dataByDate: Record<string, { [kpiId: string]: { total: number, count: number } }> = {};

        relevantLogs.forEach(log => {
            const dateStr = format(log.date.toDate(), 'yyyy-MM-dd');
            if (!dataByDate[dateStr]) dataByDate[dateStr] = {};
            if (!dataByDate[dateStr][log.kpiId]) dataByDate[dateStr][log.kpiId] = { total: 0, count: 0 };
            dataByDate[dateStr][log.kpiId].total += log.value;
            dataByDate[dateStr][log.kpiId].count++;
        });

        const finalChartData = Object.entries(dataByDate).map(([dateStr, kpiData]) => {
            const dataPoint: ChartDataPoint = { date: format(new Date(dateStr), 'MMM dd') };
            kpis.forEach(kpi => {
                const kpiEntry = kpiData[kpi.id];
                if (kpiEntry) {
                    const avgValue = kpiEntry.total / kpiEntry.count;
                    dataPoint[kpi.name] = parseFloat(avgValue.toFixed(2));
                }
            });
            return dataPoint;
        }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return {
            chartData: finalChartData,
            percentageKpis: kpis.filter(k => k.type === 'percentage'),
            numberKpis: kpis.filter(k => k.type !== 'percentage'),
        };
    }, [timeframe, logs, kpis]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-primary" /> Performance Charts</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="grid gap-2">
                        <Label>Data Scope</Label>
                        <Select onValueChange={handleScopeChange} value={dataScope} disabled={isLoading}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="me">Just Me</SelectItem>
                                <SelectItem value="pod">My Pod</SelectItem>
                                <SelectItem value="all">All Pods</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Timeframe</Label>
                        <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="thisWeek">This Week</SelectItem>
                                <SelectItem value="thisMonth">This Month</SelectItem>
                                <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                                <SelectItem value="allTime">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? <Skeleton className="h-[300px] w-full" /> : chartData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <AlertCircle className="mr-2"/>No data available for the selected filters.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <RechartsLineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis yAxisId="left" stroke={LINE_COLORS[1]} fontSize={12} domain={[0, 100]} tickFormatter={(value) => `${value}%`} hide={percentageKpis.length === 0} />
                            <YAxis yAxisId="right" orientation="right" stroke={LINE_COLORS[0]} fontSize={12} hide={numberKpis.length === 0} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                            <Legend />
                            {percentageKpis.map((kpi, index) => <Line key={`pct-${kpi.id}`} yAxisId="left" type="monotone" dataKey={kpi.name} stroke={LINE_COLORS[(index + numberKpis.length) % LINE_COLORS.length]} />)}
                            {numberKpis.map((kpi, index) => <Line key={`num-${kpi.id}`} yAxisId="right" type="monotone" dataKey={kpi.name} stroke={LINE_COLORS[index % LINE_COLORS.length]} />)}
                        </RechartsLineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
