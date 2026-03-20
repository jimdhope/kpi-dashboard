'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import { 
  Trophy, Users, Target, TrendingUp, Activity, Clock, Award,
  Target as TargetIcon, UserCheck, BarChart3
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { appMenuItems } from '@/components/app-navbar';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';

interface Pod {
  id: string;
  name: string;
}

interface DailyAchievementLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  date: Timestamp;
  value: number;
  points?: number;
}

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

// Mock data for reports when backend is not fully set up
const generateMockData = () => {
  const days = 30;
  const trendData = Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - i - 1);
    return {
      date: format(date, 'MMM dd'),
      fullDate: date,
      participation: Math.floor(Math.random() * 30) + 60,
      performance: Math.floor(Math.random() * 500) + 200,
      activity: Math.floor(Math.random() * 20) + 10,
      score: Math.floor(Math.random() * 1000) + 500,
    };
  });

  const agentActivityData = [
    { name: 'Active', value: 45, color: '#22c55e' },
    { name: 'Moderate', value: 30, color: '#eab308' },
    { name: 'Low', value: 15, color: '#ef4444' },
    { name: 'Inactive', value: 10, color: '#6b7280' },
  ];

  const podPerformanceData = [
    { pod: 'Alpha', score: 2400, participants: 12 },
    { pod: 'Beta', score: 2100, participants: 10 },
    { pod: 'Gamma', score: 1950, participants: 15 },
    { pod: 'Delta', score: 1800, participants: 8 },
    { pod: 'Epsilon', score: 1650, participants: 11 },
  ];

  return { trendData, agentActivityData, podPerformanceData };
};

const REPORTS_POD_KEY = 'reports_selectedPodId';
const REPORTS_DATE_RANGE_KEY = 'reports_dateRange';

export default function ReportsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [logs, setLogs] = useState<DailyAchievementLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Load saved filter preferences
  useEffect(() => {
    const savedPodId = localStorage.getItem(REPORTS_POD_KEY);
    if (savedPodId) {
      setSelectedPodId(savedPodId);
    }

    // Set default date range to last 30 days
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date(),
    });
  }, []);

  // Fetch data from Firestore
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const fetchPods = () => {
      const podsQuery = query(collection(db, 'pods'), orderBy('name'));
      unsubscribes.push(
        onSnapshot(podsQuery, (snapshot) => {
          setPods(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Pod)));
        })
      );
    };

    const fetchCompetitions = () => {
      const compsQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
      unsubscribes.push(
        onSnapshot(compsQuery, (snapshot) => {
          setCompetitions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Competition)));
        })
      );
    };

    const fetchLogs = () => {
      // Get logs from the last 90 days by default
      const ninetyDaysAgo = Timestamp.fromDate(subDays(new Date(), 90));
      const logsQuery = query(
        collection(db, 'dailyAchievements'),
        where('date', '>=', ninetyDaysAgo),
        orderBy('date', 'desc')
      );
      unsubscribes.push(
        onSnapshot(logsQuery, (snapshot) => {
          setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAchievementLog)));
          setIsLoading(false);
        })
      );
    };

    const fetchUsers = () => {
      const usersQuery = query(collection(db, 'users'), orderBy('name'));
      unsubscribes.push(
        onSnapshot(usersQuery, (snapshot) => {
          setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
        })
      );
    };

    fetchPods();
    fetchCompetitions();
    fetchLogs();
    fetchUsers();

    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  // Handle filter changes
  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    if (podId === 'all') {
      localStorage.removeItem(REPORTS_POD_KEY);
    } else {
      localStorage.setItem(REPORTS_POD_KEY, podId);
    }
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  const handleReset = () => {
    setSelectedPodId('all');
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date(),
    });
    localStorage.removeItem(REPORTS_POD_KEY);
  };

  // Filter data based on selected filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by pod
      if (selectedPodId !== 'all' && log.podId !== selectedPodId) {
        return false;
      }
      
      // Filter by date range
      if (dateRange?.from && dateRange?.to) {
        const logDate = log.date?.toDate?.() || new Date();
        if (!isWithinInterval(logDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) {
          return false;
        }
      }
      
      return true;
    });
  }, [logs, selectedPodId, dateRange]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    // Get unique participants
    const uniqueAgents = new Set(filteredLogs.map((log) => log.agentId));
    const uniquePods = new Set(filteredLogs.map((log) => log.podId));
    const totalPoints = filteredLogs.reduce((sum, log) => sum + (log.points || 0), 0);
    const totalEntries = filteredLogs.length;
    
    // Calculate daily average
    const dayCount = dateRange?.from && dateRange?.to
      ? Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)))
      : 30;
    const avgDailyEntries = Math.round(totalEntries / dayCount);

    return {
      totalParticipants: uniqueAgents.size,
      activePods: uniquePods.size,
      totalPoints,
      avgDailyEntries,
    };
  }, [filteredLogs, dateRange]);

  // Generate trend data for charts
  const chartData = useMemo(() => {
    const mockData = generateMockData();
    
    // If we have real data, use it; otherwise use mock
    if (filteredLogs.length > 0) {
      // Group logs by date
      const logsByDate: Record<string, { participation: number; performance: number; activity: number; score: number }> = {};
      
      filteredLogs.forEach((log) => {
        const date = format(log.date?.toDate?.() || new Date(), 'MMM dd');
        if (!logsByDate[date]) {
          logsByDate[date] = { participation: 0, performance: 0, activity: 0, score: 0 };
        }
        logsByDate[date].participation += 1;
        logsByDate[date].performance += log.value || 0;
        logsByDate[date].score += log.points || 0;
        logsByDate[date].activity = new Set(filteredLogs.map((l) => l.agentId)).size;
      });

      return Object.entries(logsByDate).map(([date, data]) => ({
        date,
        participation: data.participation,
        performance: data.performance,
        activity: data.activity,
        score: data.score,
      })).sort((a, b) => a.date.localeCompare(b.date));
    }

    // Return mock data filtered by date range
    return mockData.trendData.filter((d) => {
      if (dateRange?.from && dateRange?.to) {
        return isWithinInterval(d.fullDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
      }
      return true;
    });
  }, [filteredLogs, dateRange]);

  // Agent activity breakdown
  const agentActivityData = useMemo(() => {
    const agentScores: Record<string, number> = {};
    filteredLogs.forEach((log) => {
      agentScores[log.agentId] = (agentScores[log.agentId] || 0) + (log.points || 0);
    });

    const totalAgents = Object.keys(agentScores).length;
    if (totalAgents === 0) {
      return generateMockData().agentActivityData;
    }

    const sortedScores = Object.values(agentScores).sort((a, b) => b - a);
    const avgScore = sortedScores.reduce((a, b) => a + b, 0) / totalAgents;

    const active = sortedScores.filter((s) => s >= avgScore).length;
    const moderate = sortedScores.filter((s) => s >= avgScore * 0.5 && s < avgScore).length;
    const low = sortedScores.filter((s) => s > 0 && s < avgScore * 0.5).length;
    const inactive = totalAgents - active - moderate - low;

    return [
      { name: 'Active', value: active, color: '#22c55e' },
      { name: 'Moderate', value: moderate, color: '#eab308' },
      { name: 'Low', value: low, color: '#ef4444' },
      { name: 'Inactive', value: inactive, color: '#6b7280' },
    ];
  }, [filteredLogs]);

  // Pod performance data
  const podPerformanceData = useMemo(() => {
    const podScores: Record<string, number> = {};
    const podParticipants: Record<string, Set<string>> = {};

    filteredLogs.forEach((log) => {
      podScores[log.podId] = (podScores[log.podId] || 0) + (log.points || 0);
      if (!podParticipants[log.podId]) {
        podParticipants[log.podId] = new Set();
      }
      podParticipants[log.podId].add(log.agentId);
    });

    const podNames: Record<string, string> = {};
    pods.forEach((pod) => {
      podNames[pod.id] = pod.name;
    });

    return Object.entries(podScores)
      .map(([podId, score]) => ({
        pod: podNames[podId] || podId.substring(0, 8),
        score,
        participants: podParticipants[podId]?.size || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [filteredLogs, pods]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-10 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const chartConfig = {
    participation: { label: 'Participation', color: 'hsl(var(--chart-1))' },
    performance: { label: 'Performance', color: 'hsl(var(--chart-2))' },
    activity: { label: 'Activity', color: 'hsl(var(--chart-3))' },
    score: { label: 'Score', color: 'hsl(var(--chart-4))' },
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        sectionItems={appMenuItems.find((item) => item.key === 'performance')?.items}
      />

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          View comprehensive analytics and performance reports across your competitions
        </p>
      </div>

      {/* Filters */}
      <ReportFilters
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        selectedPodId={selectedPodId}
        onPodChange={handlePodChange}
        pods={pods}
        onReset={handleReset}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ReportCard
          title="Total Participants"
          description="Unique agents in period"
          value={summaryMetrics.totalParticipants.toLocaleString()}
          icon={Users}
          trend={{ value: 12, label: 'vs last period' }}
          variant="glass"
        />
        <ReportCard
          title="Active Pods"
          description="Pods with activity"
          value={summaryMetrics.activePods.toLocaleString()}
          icon={TargetIcon}
          variant="glass"
        />
        <ReportCard
          title="Total Points"
          description="Across all activities"
          value={summaryMetrics.totalPoints.toLocaleString()}
          icon={Trophy}
          trend={{ value: 8, label: 'vs last period' }}
          variant="glass"
        />
        <ReportCard
          title="Daily Average"
          description="Entries per day"
          value={summaryMetrics.avgDailyEntries.toLocaleString()}
          icon={Activity}
          variant="glass"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance Trends Chart */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Performance Trends
            </CardTitle>
            <CardDescription>Score and participation over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-score)"
                  fill="var(--color-score)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="participation"
                  stroke="var(--color-participation)"
                  fill="var(--color-participation)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Activity Over Time Chart */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Agent Activity
            </CardTitle>
            <CardDescription>Daily activity levels</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="activity"
                  fill="var(--color-activity)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Agent Activity Distribution */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Agent Distribution
            </CardTitle>
            <CardDescription>Activity level breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              <PieChart width={200} height={200}>
                <Pie
                  data={agentActivityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {agentActivityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {agentActivityData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pod Performance */}
        <Card className="frosted-glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Pod Performance
            </CardTitle>
            <CardDescription>Top performing pods by score</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={podPerformanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  type="category"
                  dataKey="pod"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  className="text-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="score"
                  fill="var(--color-performance)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Competition Summary Table */}
      {competitions.length > 0 && (
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Competition Summary
            </CardTitle>
            <CardDescription>Recent competitions overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="space-y-4">
                {competitions.slice(0, 5).map((comp) => {
                  const compLogs = filteredLogs.filter((l) => l.competitionId === comp.id);
                  const uniqueAgents = new Set(compLogs.map((l) => l.agentId)).size;
                  const totalPoints = compLogs.reduce((sum, l) => sum + (l.points || 0), 0);

                  return (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-card/50 border border-border/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Trophy className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{comp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {comp.startDate?.toDate && format(comp.startDate.toDate(), 'MMM d')} -{' '}
                            {comp.endDate?.toDate && format(comp.endDate.toDate(), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-bold">{uniqueAgents}</p>
                          <p className="text-xs text-muted-foreground">Participants</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{totalPoints.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Points</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{comp.rules?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">Rules</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
