'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import { onSnapshot, doc, query, collection, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfWeek } from 'date-fns';
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

interface AdditionalKpiLog {
  id?: string;
  agentId: string;
  kpiId: string;
  date: any;
  value: number;
  loggedAt: any;
}

interface ChartDataPoint {
  week: string;
  date: string;
  value: number;
}

// Helper function to determine pass/fail styling
const getCellClass = (value: number, kpi: AdditionalKpi): string => {
  if (!kpi.passFailCriteriaEnabled || kpi.passFailValue === undefined || kpi.passFailValue === null) {
    return '';
  }

  const passed = kpi.passFailOperator === 'gte' 
    ? value >= kpi.passFailValue 
    : value <= kpi.passFailValue;

  return passed 
    ? 'bg-green-500/30 dark:bg-green-900/50' 
    : 'bg-red-500/30 dark:bg-red-900/50';
};

export default function AgentPerformancePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);
  const [selectedKpiId, setSelectedKpiId] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch user
  useEffect(() => {
    let mounted = true;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists() && mounted) {
              setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
            }
          });
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      }
      if (mounted) {
        setIsLoadingData(false);
      }
    });
    
    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  // Fetch KPIs
  useEffect(() => {
    const kpisQuery = query(collection(db, 'additionalKpis'), orderBy('name'));
    const unsubscribe = onSnapshot(kpisQuery, (snapshot) => {
      const fetchedKpis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdditionalKpi));
      setKpis(fetchedKpis);
      // Set default selected KPI if not set
      if (!selectedKpiId && fetchedKpis.length > 0) {
        setSelectedKpiId(fetchedKpis[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch logs for current user
  useEffect(() => {
    if (!currentUser?.id) {
      setLogs([]);
      return;
    }

    setIsLoadingData(true);
    const logsQuery = query(collection(db, 'additionalKpiLogs'));

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      // Filter logs for current user
      const userLogs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AdditionalKpiLog))
        .filter(log => log.agentId === currentUser.id);
      setLogs(userLogs);
      setIsLoadingData(false);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Generate 6 weeks of data (starting Wednesday)
  const weekHeaders = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; start: Date; end: Date }[] = [];
    
    // Find the most recent Wednesday (or today if it's Wednesday)
    let currentWednesday = startOfWeek(now, { weekStartsOn: 3 });
    
    // If we're on Wednesday and it's today, use it; otherwise go back to last Wednesday
    const dayOfWeek = now.getDay();
    const daysSinceWednesday = dayOfWeek === 3 ? 0 : (dayOfWeek + 4) % 7; // Days since last Wednesday
    currentWednesday = new Date(now);
    currentWednesday.setDate(now.getDate() - daysSinceWednesday);
    currentWednesday.setHours(0, 0, 0, 0);
    
    // Check if there's data for this week's Wednesday
    const weekEnd = new Date(currentWednesday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Generate 6 weeks starting from the appropriate Wednesday
    for (let i = 0; i < 6; i++) {
      const weekStart = new Date(currentWednesday);
      weekStart.setDate(currentWednesday.getDate() - (i * 7));
      const weekEndDate = new Date(weekStart);
      weekEndDate.setDate(weekStart.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);
      
      weeks.unshift({
        label: format(weekStart, 'MMM d'),
        start: weekStart,
        end: weekEndDate,
      });
    }
    
    return weeks;
  }, []);

  // Calculate weekly KPI data
  const weeklyKpiData = useMemo(() => {
    if (logs.length === 0 || kpis.length === 0) return [];

    return kpis.map(kpi => {
      const weeklyValues: Record<string, number> = {};
      
      weekHeaders.forEach(week => {
        const weekLogs = logs.filter(log => {
          if (log.kpiId !== kpi.id) return false;
          const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date?.seconds ? log.date.seconds * 1000 : 0);
          return logDate >= week.start && logDate <= week.end;
        });
        
        weeklyValues[week.label] = weekLogs.reduce((sum, log) => sum + (log.value || 0), 0);
      });

      return {
        kpi,
        weeklyValues,
        total: Object.values(weeklyValues).reduce((sum, val) => sum + val, 0),
      };
    }).sort((a, b) => b.total - a.total);
  }, [logs, kpis, weekHeaders]);

  // Chart data for selected KPI
  const chartData = useMemo(() => {
    if (!selectedKpiId || kpis.length === 0) return [];

    const kpi = kpis.find(k => k.id === selectedKpiId);
    if (!kpi) return [];

    return weekHeaders.map(week => {
      const weekLogs = logs.filter(log => {
        if (log.kpiId !== kpi.id) return false;
        const logDate = log.date?.toDate ? log.date.toDate() : new Date(log.date?.seconds ? log.date.seconds * 1000 : 0);
        return logDate >= week.start && logDate <= week.end;
      });

      return {
        week: week.label,
        value: weekLogs.reduce((sum, log) => sum + (log.value || 0), 0),
      } as ChartDataPoint;
    });
  }, [selectedKpiId, kpis, logs, weekHeaders]);

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
        {/* Left - KPI Breakdown Table */}
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
                      {weekHeaders.map(week => (
                        <TableHead key={week.label} className="text-center min-w-[80px]">
                          {week.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyKpiData.map(({ kpi, weeklyValues }) => (
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
                        {weekHeaders.map(week => {
                          const value = weeklyValues[week.label];
                          const isPercentage = kpi.type === 'percentage';
                          const displayValue = value > 0 ? (isPercentage ? `${value}%` : value) : '-';
                          const cellClass = value > 0 ? getCellClass(value, kpi) : '';
                          return (
                            <TableCell 
                              key={week.label} 
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

        {/* Right - Chart */}
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
                    <XAxis 
                      dataKey="week" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(value) => value}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                    />
                    {(() => {
                      const selectedKpiData = kpis.find(k => k.id === selectedKpiId);
                      if (!selectedKpiData?.passFailCriteriaEnabled || selectedKpiData.passFailValue === undefined) return null;
                      return (
                        <ReferenceLine 
                          y={selectedKpiData.passFailValue} 
                          stroke="hsl(var(--primary))"
                          strokeDasharray="5 5"
                          label={{
                            value: `Target: ${selectedKpiData.passFailValue}`,
                            position: 'insideTopRight',
                            fill: 'hsl(var(--foreground))',
                            fontSize: 12,
                            fontWeight: 'bold',
                          }}
                        />
                      );
                    })()}
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                      activeDot={{ r: 6 }}
                      name="Value"
                    />
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
