
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfWeek, subWeeks, startOfMonth, endOfMonth, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChartHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';

interface AgentKpiBreakdownWidgetProps {
    currentUser: AppUser;
}

type Timeframe = 'last6weeks' | 'thisWeek' | 'thisMonth' | 'allTime';
const AGENT_WIDGET_BREAKDOWN_TIMEFRAME_KEY = 'agentWidget_breakdown_timeframe';

interface WeeklyKpiTotals {
  [kpiId: string]: {
      value: number;
      count: number;
  };
}

export function AgentKpiBreakdownWidget({ currentUser }: AgentKpiBreakdownWidgetProps) {
    const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
    const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);
    const [timeframe, setTimeframe] = useState<Timeframe>('last6weeks');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedTimeframe = localStorage.getItem(AGENT_WIDGET_BREAKDOWN_TIMEFRAME_KEY) as Timeframe | null;
        if (savedTimeframe) setTimeframe(savedTimeframe);
    }, []);

    const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(AGENT_WIDGET_BREAKDOWN_TIMEFRAME_KEY, tf); };

    useEffect(() => {
        setIsLoading(true);
        const unsubscribes = [
            onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), (snap) => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))),
            onSnapshot(query(collection(db, 'additionalKpiLogs'), where('agentId', '==', currentUser.id)), (snap) => {
                setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog)));
                setIsLoading(false);
            })
        ];
        return () => unsubscribes.forEach(unsub => unsub());
    }, [currentUser.id]);

    const filteredLogs = useMemo(() => {
        if (timeframe === 'allTime') return logs;
        const now = new Date();
        let startDate: Date;
        const weekStartsOn = 1; // Monday

        switch (timeframe) {
            case 'thisWeek': startDate = startOfWeek(now, { weekStartsOn }); break;
            case 'thisMonth': startDate = startOfMonth(now); break;
            case 'last6weeks': default: startDate = startOfWeek(subWeeks(now, 5), { weekStartsOn }); break;
        }
        return logs.filter(log => log.date.toDate() >= startDate);
    }, [logs, timeframe]);

    const { processedData, weekHeaders, podKpis } = useMemo(() => {
        if (filteredLogs.length === 0 || kpis.length === 0) return { processedData: {}, weekHeaders: [], podKpis: [] };
        
        const podKpiIds = new Set(filteredLogs.map(log => log.kpiId));
        const podKpis = kpis.filter(kpi => podKpiIds.has(kpi.id)).sort((a,b) => a.name.localeCompare(b.name));
        
        const weeklyScores: { [weekOf: string]: WeeklyKpiTotals } = {};
        const weeks = new Set<string>();

        filteredLogs.forEach(log => {
            const weekStart = startOfWeek(log.date.toDate(), { weekStartsOn: 1 });
            const weekOf = format(weekStart, 'MMM dd, yyyy');
            weeks.add(weekOf);

            const kpiDetails = kpis.find(k => k.id === log.kpiId);
            if (kpiDetails) {
                if (!weeklyScores[weekOf]) weeklyScores[weekOf] = {};
                if (!weeklyScores[weekOf][log.kpiId]) weeklyScores[weekOf][log.kpiId] = { value: 0, count: 0 };
                weeklyScores[weekOf][log.kpiId].value += log.value;
                weeklyScores[weekOf][log.kpiId].count += 1;
            }
        });

        const weekHeaders = Array.from(weeks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        return { processedData: weeklyScores, weekHeaders, podKpis };
    }, [filteredLogs, kpis]);
    
    const getScoreCellClass = (score: number | undefined, kpi: AdditionalKpi): string => {
        if (score === undefined || !kpi.passFailCriteriaEnabled || kpi.passFailValue === undefined) return '';
        const passed = kpi.passFailOperator === 'gte' ? score >= kpi.passFailValue : score <= kpi.passFailValue;
        return passed ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChartHorizontal className="h-5 w-5 text-primary" /> My KPI Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-2 mb-4 max-w-xs">
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
                {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Week</TableHead>
                                {podKpis.map(kpi => <TableHead key={kpi.id} className="text-center">{kpi.initials}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {weekHeaders.map(week => (
                                <TableRow key={week}>
                                    <TableCell className="font-medium">{week}</TableCell>
                                    {podKpis.map(kpi => {
                                        const weeklyData = processedData[week]?.[kpi.id];
                                        let score: number | undefined;
                                        if (weeklyData) {
                                            score = kpi.type === 'percentage'
                                                ? (weeklyData.count > 0 ? weeklyData.value / weeklyData.count : 0)
                                                : weeklyData.value;
                                        }
                                        return (
                                            <TableCell key={kpi.id} className={cn('text-center font-medium', getScoreCellClass(score, kpi))}>
                                                {score !== undefined ? (kpi.type === 'percentage' ? `${score.toFixed(1)}%` : score.toLocaleString()) : '-'}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
