'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ReferenceLine,
} from 'recharts';
import type { AppUser } from '@/lib/contracts';

interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: string;
  maxValue?: number;
  passFailCriteriaEnabled?: boolean;
  passFailOperator?: 'gte' | 'lte';
  passFailValue?: number;
}

interface PerformanceLog {
  id: string;
  userId: string;
  kpiId: string;
  date: string;
  value: number;
}

interface ChartDataPoint {
  week: string;
  value: number;
}

const getCellClass = (value: number, kpi: AdditionalKpi): string => {
  if (!kpi.passFailCriteriaEnabled || kpi.passFailValue === undefined || kpi.passFailValue === null) {
    return '';
  }
  const passed = kpi.passFailOperator === 'gte' 
    ? value >= kpi.passFailValue 
    : value <= kpi.passFailValue;
  return passed ? 'bg-green-500/30 dark:bg-green-900/50' : 'bg-red-500/30 dark:bg-red-900/50';
};

export default function AgentPerformancePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [selectedKpiId, setSelectedKpiId] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      }
    }
    fetchSession();
  }, []);

  useEffect(() => {
    async function fetchKpis() {
      try {
        const res = await fetch('/api/kpis');
        if (res.ok) {
          const data = await res.json();
          setKpis(data.kpis || []);
          if (!selectedKpiId && (data.kpis || []).length > 0) {
            setSelectedKpiId(data.kpis[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching KPIs:', err);
      }
    }
    fetchKpis();
  }, [selectedKpiId]);

  useEffect(() => {
    async function fetchLogs() {
      if (!currentUser?.id) {
        setLogs([]);
        return;
      }
      setIsLoadingData(true);
      try {
        const res = await fetch('/api/performance/kpi-logs');
        if (res.ok) {
          const data = await res.json();
          const userLogs = (data.logs || []).filter((log: PerformanceLog) => log.userId === currentUser.id);
          setLogs(userLogs);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      }
      setIsLoadingData(false);
    }
    fetchLogs();
  }, [currentUser?.id]);

  const weeklyKpiData = useMemo(() => {
    if (logs.length === 0 || kpis.length === 0) return [];
    return kpis.map(kpi => {
      const kpiLogs = logs.filter(log => log.kpiId === kpi.id);
      if (kpiLogs.length === 0) {
        return { kpi, weeklyValues: {}, weekLabels: [], total: 0 };
      }

      const maxDate = kpiLogs.reduce((latest, log) => {
        const d = new Date(log.date);
        return d > latest ? d : latest;
      }, new Date(0));

      const weeks: { label: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const weekEnd = new Date(maxDate);
        weekEnd.setDate(maxDate.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        weeks.push({
          label: format(weekStart, 'MMM d'),
          start: weekStart,
          end: weekEnd,
        });
      }

      const weeklyValues: Record<string, number> = {};
      weeks.forEach(week => {
        const weekLogs = kpiLogs.filter(log => {
          const logDate = new Date(log.date);
          return logDate >= week.start && logDate <= week.end;
        });
        weeklyValues[week.label] = weekLogs.reduce((sum, log) => sum + (log.value || 0), 0);
      });

      return {
        kpi,
        weeklyValues,
        weekLabels: weeks.map(w => w.label),
        total: Object.values(weeklyValues).reduce((sum, val) => sum + val, 0),
      };
    }).sort((a, b) => b.total - a.total);
  }, [logs, kpis]);

  const chartData = useMemo(() => {
    if (!selectedKpiId || kpis.length === 0 || logs.length === 0) return [];
    const kpiLogs = logs.filter(log => log.kpiId === selectedKpiId);
    if (kpiLogs.length === 0) return [];

    const maxDate = kpiLogs.reduce((latest, log) => {
      const d = new Date(log.date);
      return d > latest ? d : latest;
    }, new Date(0));

    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const weekEnd = new Date(maxDate);
      weekEnd.setDate(maxDate.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      weeks.push({
        label: format(weekStart, 'MMM d'),
        start: weekStart,
        end: weekEnd,
      });
    }

    return weeks.map(week => {
      const weekLogs = kpiLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= week.start && logDate <= week.end;
      });
      return {
        week: week.label,
        value: weekLogs.reduce((sum, log) => sum + (log.value || 0), 0),
      } as ChartDataPoint;
    });
  }, [selectedKpiId, kpis, logs]);

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="lg:col-span-3 h-96" />
          <Skeleton className="lg:col-span-2 h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Performance</h1>
        <p className="text-muted-foreground">Your KPI scores over the last 6 weeks</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card variant="glass" className="lg:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Your KPI Performance (Last 6 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : weeklyKpiData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No performance data available</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-glass-border/30">
                      <TableHead className="w-[200px]">KPI</TableHead>
                      <TableHead className="text-center min-w-[80px]">W1</TableHead>
                      <TableHead className="text-center min-w-[80px]">W2</TableHead>
                      <TableHead className="text-center min-w-[80px]">W3</TableHead>
                      <TableHead className="text-center min-w-[80px]">W4</TableHead>
                      <TableHead className="text-center min-w-[80px]">W5</TableHead>
                      <TableHead className="text-center min-w-[80px]">W6</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyKpiData.map(({ kpi, weeklyValues, weekLabels }) => (
                      <TableRow 
                        key={kpi.id} 
                        className={selectedKpiId === kpi.id ? 'bg-primary/10' : 'border-b border-glass-border/20'}
                        onClick={() => setSelectedKpiId(kpi.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">{kpi.initials}</span>
                            </div>
                            <span className="truncate" title={kpi.name}>{kpi.name}</span>
                          </div>
                        </TableCell>
                        {weekLabels.map(label => {
                          const value = weeklyValues[label];
                          const isPercentage = kpi.type === 'percentage';
                          const displayValue = value > 0 ? (isPercentage ? `${value}%` : value) : '-';
                          const cellClass = value > 0 ? getCellClass(value, kpi) : '';
                          return (
                            <TableCell 
                              key={label} 
                              title={value > 0 ? `${kpi.name} - week of ${label}` : 'No data'}
                              className={`text-center font-medium rounded-sm ${cellClass}`}
                            >
                              {displayValue}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass" className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Trend
              </CardTitle>
              <Select value={selectedKpiId} onValueChange={setSelectedKpiId}>
                <SelectTrigger className="w-[200px] glass-input">
                  <SelectValue placeholder="Select KPI" />
                </SelectTrigger>
                <SelectContent>
                  {kpis.map(kpi => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      {kpi.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data for selected KPI</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    {(() => {
                      const selectedKpiData = kpis.find(k => k.id === selectedKpiId);
                      if (!selectedKpiData?.passFailCriteriaEnabled || selectedKpiData.passFailValue === undefined) return null;
                      return (
                        <ReferenceLine y={selectedKpiData.passFailValue} stroke="hsl(var(--primary))" strokeDasharray="5 5" />
                      );
                    })()}
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} name="Value" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
