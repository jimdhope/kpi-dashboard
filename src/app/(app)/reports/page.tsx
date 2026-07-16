'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportCard } from '@/components/reports/ReportCard';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, Target, TrendingUp, Activity, BarChart3, UserCheck } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, differenceInDays } from 'date-fns';
import {
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
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface Pod {
  id: string;
  name: string;
}

interface Achievement {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName?: string | null;
  value: number;
  points: number;
  date: string;
  createdAt: string;
}

interface Competition {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  isDraft?: boolean;
  podIds?: string[];
  rules?: Array<{
    id: string;
    title: string;
    points: number;
    emoji?: string | null;
    dailyTarget?: number | null;
  }>;
}

interface PodData {
  pod: string;
  score: number;
  participants: number;
}

interface AgentActivityItem {
  name: string;
  value: number;
  color: string;
}

// Colors for multi-line chart (one per rule)
const LINE_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#84cc16', // lime
];

// Custom tooltip for charts with frosted glass theme
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="frosted-glass border border-border/50 rounded-lg p-3 shadow-lg">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {entry.value < 1 ? 0 : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);
  const [filterType, setFilterType] = useState<'dateRange' | 'competition'>('competition');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedRules, setSelectedRules] = useState<string>('all');

  useEffect(() => {
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date(),
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [podsRes, compsRes, usersRes, achievementsRes] = await Promise.all([
          fetch('/api/pods'),
          fetch('/api/competitions'),
          fetch('/api/users'),
          fetch('/api/achievements'),
        ]);

        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          const comps = data.competitions || [];
          setCompetitions(comps);
          // Set default to latest competition (sorted by startDate descending)
          if (comps.length > 0 && !selectedCompetitionId) {
            const sorted = comps.sort((a: Competition, b: Competition) => 
              new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime()
            );
            setSelectedCompetitionId(sorted[0]?.id || '');
          }
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers((data.users || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
        }
        if (achievementsRes.ok) {
          const data = await achievementsRes.json();
          setAchievements(data.achievements || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Set default competition when competitions load
  useEffect(() => {
    if (competitions.length > 0 && !selectedCompetitionId) {
      const sorted = [...competitions].sort((a, b) => 
        new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime()
      );
      setSelectedCompetitionId(sorted[0]?.id || '');
    }
  }, [competitions, selectedCompetitionId]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
  };

  const handleDateRangeChange = (range: { from: Date; to: Date } | undefined) => {
    setDateRange(range);
  };

  const handleReset = () => {
    setSelectedPodId('all');
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date(),
    });
  };

  const filteredAchievements = useMemo(() => {
    return achievements.filter((achievement) => {
      // Pod filter always applies
      if (selectedPodId !== 'all' && achievement.podId !== selectedPodId) {
        return false;
      }
      
      // Filter by selected type
      if (filterType === 'competition') {
        // Competition filter
        if (selectedCompetitionId && achievement.competitionId !== selectedCompetitionId) {
          return false;
        }
      } else {
        // Date range filter
        if (dateRange?.from && dateRange?.to) {
          const achievementDate = new Date(achievement.date);
          if (!isWithinInterval(achievementDate, { 
            start: startOfDay(dateRange.from), 
            end: endOfDay(dateRange.to) 
          })) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [achievements, selectedPodId, dateRange, filterType, selectedCompetitionId]);

  // Calculate previous period for trend comparison (only for date range)
  const previousPeriodAchievements = useMemo(() => {
    // Skip trend calculation when filtering by competition
    if (filterType === 'competition') return [];
    
    if (!dateRange?.from || !dateRange?.to) return [];
    
    const periodDays = differenceInDays(dateRange.to, dateRange.from);
    const previousFrom = subDays(dateRange.from, periodDays);
    const previousTo = subDays(dateRange.from, 1);
    
    return achievements.filter((achievement) => {
      if (selectedPodId !== 'all' && achievement.podId !== selectedPodId) {
        return false;
      }
      
      const achievementDate = new Date(achievement.date);
      if (!isWithinInterval(achievementDate, { 
        start: startOfDay(previousFrom), 
        end: endOfDay(previousTo) 
      })) {
        return false;
      }
      
      return true;
    });
  }, [achievements, selectedPodId, dateRange, filterType]);

  const summaryMetrics = useMemo(() => {
    const uniqueAgents = new Set(filteredAchievements.map((a) => a.agentId));
    const uniquePods = new Set(filteredAchievements.map((a) => a.podId));
    const totalPoints = filteredAchievements.reduce((sum, a) => sum + (a.points || 0), 0);
    const totalEntries = filteredAchievements.length;
    
    // For competition filter, use the competition's date range for avg calculation
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
    let dayCount = 30;
    if (filterType === 'competition' && selectedComp?.startsAt && selectedComp?.endsAt) {
      dayCount = Math.max(1, Math.ceil(
        (new Date(selectedComp.endsAt).getTime() - new Date(selectedComp.startsAt).getTime()) / (1000 * 60 * 60 * 24)
      ));
    } else if (dateRange?.from && dateRange?.to) {
      dayCount = Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const avgDailyEntries = Math.round(totalEntries / dayCount);

    // Calculate trends vs previous period (only for date range filter)
    let participantsTrend = 0;
    let pointsTrend = 0;
    let avgTrend = 0;

    if (filterType === 'dateRange' && previousPeriodAchievements.length > 0) {
      const prevUniqueAgents = new Set(previousPeriodAchievements.map((a) => a.agentId));
      const prevTotalPoints = previousPeriodAchievements.reduce((sum, a) => sum + (a.points || 0), 0);
      const prevAvgDailyEntries = previousPeriodAchievements.length / dayCount;

      participantsTrend = prevUniqueAgents.size > 0 
        ? Math.round(((uniqueAgents.size - prevUniqueAgents.size) / prevUniqueAgents.size) * 100)
        : 0;
      pointsTrend = prevTotalPoints > 0
        ? Math.round(((totalPoints - prevTotalPoints) / prevTotalPoints) * 100)
        : 0;
      avgTrend = prevAvgDailyEntries > 0
        ? Math.round(((avgDailyEntries - prevAvgDailyEntries) / prevAvgDailyEntries) * 100)
        : 0;
    }

    return {
      totalParticipants: uniqueAgents.size,
      activePods: uniquePods.size,
      totalPoints,
      avgDailyEntries,
      trends: {
        participants: participantsTrend,
        points: pointsTrend,
        avgDaily: avgTrend,
      },
    };
  }, [filteredAchievements, previousPeriodAchievements, dateRange, filterType, selectedCompetitionId, competitions]);

  const ruleBreakdown = useMemo(() => {
    if (filterType === 'competition' && !selectedCompetitionId) return [];
    
    const competition = competitions.find(c => c.id === selectedCompetitionId);
    const competitionRuleOrder = competition?.rules?.map(r => r.title) || [];
    
    // Get unique agents who participated (present agents)
    const presentAgentIds = new Set<string>();
    filteredAchievements.forEach((a) => {
      if (a.value > 0 || a.points > 0) {
        presentAgentIds.add(a.agentId);
      }
    });
    const presentAgentCount = presentAgentIds.size;
    
    // Calculate active days (excluding weekends) if competition filter
    let activeDays = 0;
    if (filterType === 'competition' && competition?.startsAt && competition?.endsAt) {
      const start = new Date(competition.startsAt);
      const end = new Date(competition.endsAt);
      const now = new Date();
      const effectiveEnd = now < end ? now : end;
      
      let current = new Date(start);
      while (current <= effectiveEnd) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) activeDays++;
        current.setDate(current.getDate() + 1);
      }
      activeDays = Math.max(1, activeDays);
    }
    
    const ruleCounts: Record<string, { 
      ruleName: string;
      ruleId: string;
      emoji?: string | null;
      dailyTarget?: number | null;
      effectiveTarget?: number | null;
      count: number;
      totalValue: number;
      totalPoints: number;
    }> = {};
    
    filteredAchievements.forEach((a) => {
      const key = a.ruleName || 'unknown';
      if (!ruleCounts[key]) {
        ruleCounts[key] = {
          ruleName: key,
          ruleId: key,
          count: 0,
          totalValue: 0,
          totalPoints: 0,
        };
        if (competition?.rules) {
          const compRule = competition.rules.find(r => r.title === key);
          if (compRule) {
            ruleCounts[key].emoji = compRule.emoji;
            ruleCounts[key].dailyTarget = compRule.dailyTarget;
            // effective target = daily target × active days × present agents
            if (compRule.dailyTarget && activeDays > 0 && presentAgentCount > 0) {
              ruleCounts[key].effectiveTarget = compRule.dailyTarget * activeDays * presentAgentCount;
            } else if (compRule.dailyTarget && activeDays > 0) {
              ruleCounts[key].effectiveTarget = compRule.dailyTarget * activeDays;
            }
          }
        }
      }
      ruleCounts[key].count += a.value || 1;
      ruleCounts[key].totalValue += a.value || 0;
      ruleCounts[key].totalPoints += a.points || 0;
    });
    
    return Object.values(ruleCounts)
      .filter(r => competitionRuleOrder.includes(r.ruleName))
      .sort((a, b) => {
        const aIndex = competitionRuleOrder.indexOf(a.ruleName);
        const bIndex = competitionRuleOrder.indexOf(b.ruleName);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }, [filteredAchievements, filterType, selectedCompetitionId, competitions]);

  const chartData = useMemo(() => {
    const logsByDate: Record<string, { participation: number; score: number; activity: number }> = {};
    
    filteredAchievements.forEach((a) => {
      const date = format(new Date(a.date), 'MMM dd');
      if (!logsByDate[date]) {
        logsByDate[date] = { participation: 0, score: 0, activity: 0 };
      }
      logsByDate[date].participation += 1;
      logsByDate[date].score += a.points || 0;
    });

    // Calculate activity (unique agents per day)
    const agentsByDate: Record<string, Set<string>> = {};
    filteredAchievements.forEach((a) => {
      const date = format(new Date(a.date), 'MMM dd');
      if (!agentsByDate[date]) agentsByDate[date] = new Set();
      agentsByDate[date].add(a.agentId);
    });
    Object.keys(logsByDate).forEach(date => {
      logsByDate[date].activity = agentsByDate[date]?.size || 0;
    });

    return Object.entries(logsByDate)
      .map(([date, data]) => ({
        date,
        participation: data.participation,
        score: data.score,
        activity: data.activity,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredAchievements]);

  // Multi-line chart data for Performance Trends (4 latest competitions)
  const competitionTrendsData = useMemo(() => {
    if (filterType !== 'competition') return [];
    
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
    if (!selectedComp?.rules || selectedComp.rules.length === 0) return [];
    
    // Get rules from selected competition
    const ruleNames = selectedComp.rules.map(r => r.title);
    
    // Sort competitions oldest to newest
    const sortedCompetitions = [...competitions]
      .filter(c => !c.isDraft)
      .sort((a, b) => new Date(a.startsAt || 0).getTime() - new Date(b.startsAt || 0).getTime());
    
    // Find index of selected competition
    const selectedIndex = sortedCompetitions.findIndex(c => c.id === selectedCompetitionId);
    if (selectedIndex === -1) return [];
    
    // Get up to 6 competitions ending at selected (go back up to 5 positions)
    const startIndex = Math.max(0, selectedIndex - 5);
    const recentCompetitions = sortedCompetitions.slice(startIndex, selectedIndex + 1);
    
    if (recentCompetitions.length === 0) return [];
    
    // For each competition, count achievements per rule (sum values, apply pod filter)
    // Show chronologically: oldest left, selected right
    // Note: Replace 0 with 0.1 for log-scale compatibility (will display as 0 in tooltip)
    return recentCompetitions.map(comp => {
      const point: Record<string, string | number> = { name: comp.name };
      ruleNames.forEach(ruleName => {
        const matchingAchievements = achievements
          .filter(a => 
            a.competitionId === comp.id && 
            a.ruleName === ruleName &&
            (selectedPodId === 'all' || a.podId === selectedPodId)
          );
        const count = matchingAchievements.reduce((sum, a) => sum + (a.value || 1), 0);
        point[ruleName] = Math.max(0.1, count);  // 0.1 for log scale compatibility
      });
      return point;
    });
  }, [achievements, competitions, selectedCompetitionId, filterType, selectedPodId]);

  const agentActivityData = useMemo((): AgentActivityItem[] => {
    const agentScores: Record<string, number> = {};
    filteredAchievements.forEach((a) => {
      agentScores[a.agentId] = (agentScores[a.agentId] || 0) + (a.points || 0);
    });

    const totalAgents = Object.keys(agentScores).length;
    if (totalAgents === 0) {
      return [
        { name: 'Active', value: 0, color: '#22c55e' },
        { name: 'Moderate', value: 0, color: '#eab308' },
        { name: 'Low', value: 0, color: '#ef4444' },
        { name: 'Inactive', value: 0, color: '#6b7280' },
      ];
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
  }, [filteredAchievements]);

  // Top performers by rule
  const topPerformersByRule = useMemo(() => {
    if (filterType !== 'competition' || !selectedCompetitionId) return [];
    
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
    if (!selectedComp?.rules) return [];
    
    // Build user ID to name map
    const userNameMap: Record<string, string> = {};
    users.forEach(u => {
      userNameMap[u.id] = u.name;
    });
    
    return selectedComp.rules.map(rule => {
      // Get all achievements for this rule in selected competition
      const ruleAchievements = achievements.filter(
        a => a.competitionId === selectedCompetitionId && a.ruleName === rule.title
      );
      
      if (ruleAchievements.length === 0) return null; // Skip empty rules
      
      // Count achievements per agent (sum the value field, not entries)
      const agentCounts: Record<string, number> = {};
      ruleAchievements.forEach(a => {
        agentCounts[a.agentId] = (agentCounts[a.agentId] || 0) + (a.value || 1);
      });
      
      // Find max count (for tie detection)
      const maxCount = Math.max(...Object.values(agentCounts));
      
      // Get all agents with max count (all tied)
      const topAgents = Object.entries(agentCounts)
        .filter(([_, count]) => count === maxCount)
        .map(([agentId, count]) => ({
          agentId,
          agentName: userNameMap[agentId] || agentId.substring(0, 8),
          count,
        }));
      
      return {
        ruleId: rule.id,
        ruleName: rule.title,
        emoji: rule.emoji,
        topAgents,
        maxCount,
        totalCount: maxCount,
      };
    }).filter(Boolean) as Array<{
      ruleId: string;
      ruleName: string;
      emoji: string | null;
      topAgents: Array<{ agentId: string; agentName: string; count: number }>;
      maxCount: number;
      totalCount: number;
    }>;
  }, [achievements, competitions, selectedCompetitionId, filterType, users]);

  const podPerformanceData = useMemo((): PodData[] => {
    const podScores: Record<string, number> = {};
    const podParticipants: Record<string, Set<string>> = {};

    filteredAchievements.forEach((a) => {
      podScores[a.podId] = (podScores[a.podId] || 0) + (a.points || 0);
      if (!podParticipants[a.podId]) {
        podParticipants[a.podId] = new Set();
      }
      podParticipants[a.podId].add(a.agentId);
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
  }, [filteredAchievements, pods]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
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

  return (
    <div className="space-y-6">
      <Breadcrumbs />

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          View comprehensive analytics and performance reports across your competitions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-card border border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>Filters</span>
        </div>
        
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Filter Type Selector */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'dateRange' | 'competition')}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
          >
            <option value="dateRange">Date Range</option>
            <option value="competition">Competition</option>
          </select>
          
          {/* Conditional: Date Range or Competition selector */}
          {filterType === 'competition' ? (
            <select
              value={selectedCompetitionId}
              onChange={(e) => setSelectedCompetitionId(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md bg-background min-w-[200px]"
            >
              {competitions
                .sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime())
                .map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
            </select>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">From:</span>
                <input
                  type="date"
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={dateRange?.from ? dateRange.from.toISOString().split('T')[0] : ''}
                  onChange={(e) => setDateRange({ 
                    from: new Date(e.target.value), 
                    to: dateRange?.to || new Date() 
                  })}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">To:</span>
                <input
                  type="date"
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={dateRange?.to ? dateRange.to.toISOString().split('T')[0] : ''}
                  onChange={(e) => setDateRange({ 
                    from: dateRange?.from || subDays(new Date(), 30), 
                    to: new Date(e.target.value) 
                  })}
                />
              </div>
            </div>
          )}
          
          {/* Pod Filter */}
          <select
            value={selectedPodId}
            onChange={(e) => handlePodChange(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
          >
            <option value="all">All Pods</option>
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name}
              </option>
            ))}
          </select>

          {selectedPodId !== 'all' && (
            <button
              onClick={() => setSelectedPodId('all')}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Rule Breakdown Cards */}
      {ruleBreakdown.length === 0 ? (
        <Card className="frosted-glass">
          <CardContent className="py-8 text-center text-muted-foreground">
            No achievements found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ruleBreakdown.map((rule) => {
            // Use effectiveTarget if available, otherwise daily target
            const displayTarget = rule.effectiveTarget || rule.dailyTarget;
            const targetProgress = displayTarget 
              ? Math.min(100, (rule.totalValue / displayTarget) * 100)
              : null;
            
            return (
              <Card key={rule.ruleId} className="frosted-glass">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {rule.emoji && <span className="text-2xl">{rule.emoji}</span>}
                    <span className="truncate">{rule.ruleName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Count</p>
                      <p className="font-semibold">{rule.count.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Points</p>
                      <p className="font-semibold">{rule.totalPoints.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* Progress towards target (if set) */}
                  {targetProgress !== null && displayTarget && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">vs Target</span>
                        <span className="font-medium">{rule.totalValue.toLocaleString()} / {displayTarget.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${targetProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance Trends Chart - Multi-line by rule */}
        <Card className="frosted-glass">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Performance Trends
                </CardTitle>
                <CardDescription>Achievement counts by rule across competitions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Rule Selector */}
                <select
                  value={selectedRules}
                  onChange={(e) => setSelectedRules(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-md bg-background"
                >
                  <option value="all">All Rules</option>
                  {competitions.find(c => c.id === selectedCompetitionId)?.rules?.map((rule) => (
                    <option key={rule.id} value={rule.title}>{rule.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {competitionTrendsData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Select a competition to view trends
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350} minWidth={0}>
                <LineChart data={competitionTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    allowDecimals={false}
                    scale={selectedRules === 'all' ? 'log' : 'auto'}
                    domain={selectedRules === 'all' ? [1, 'dataMax'] : [0, 'auto']}
                    hide={selectedRules === 'all'}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  {competitions.find(c => c.id === selectedCompetitionId)?.rules
                    ?.filter(rule => {
                      // If specific rule selected, always show it
                      if (selectedRules !== 'all') return rule.title === selectedRules;
                      // When showing all rules (log scale), hide rules with all-zero values
                      if (selectedRules === 'all') {
                        return competitionTrendsData.some(d => Number(d[rule.title] || 0) > 0);
                      }
                      return true;
                    })
                    .map((rule, index) => (
                      <Line
                        key={rule.id}
                        type="monotone"
                        dataKey={rule.title}
                        stroke={LINE_COLORS[index % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Performers Card */}
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Top Performers
            </CardTitle>
            <CardDescription>Top performer for each rule</CardDescription>
          </CardHeader>
          <CardContent>
            {topPerformersByRule.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-px -mx-4">
                {/* Table Header */}
                <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50 bg-muted/30 sticky top-0">
                  <span>Rule</span>
                  <span>Top Performer</span>
                  <span className="text-right">Count</span>
                </div>
                {/* Table Body */}
                <div className="max-h-[300px] overflow-y-auto">
                  {topPerformersByRule.map((rule, index) => (
                    <div 
                      key={rule.ruleId}
                      className={`grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2.5 items-center text-sm ${
                        index % 2 === 0 ? 'bg-card/50' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {rule.emoji && <span className="text-lg flex-shrink-0">{rule.emoji}</span>}
                        <span className="truncate" title={rule.ruleName}>{rule.ruleName}</span>
                      </div>
                      <span className="text-muted-foreground truncate" title={rule.topAgents.map(a => a.agentName).join(', ')}>
                        {rule.topAgents.map(a => a.agentName).join(', ')}
                      </span>
                      <span className="font-medium text-right tabular-nums">{rule.totalCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Competition History */}
      {competitions.length > 0 && (
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Competition History
            </CardTitle>
            <CardDescription>Recent competitions overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {competitions.slice(0, 10).map((comp) => {
                // Use all achievements, applying pod filter separately
                const compAchievements = achievements.filter((a) => 
                  a.competitionId === comp.id &&
                  (selectedPodId === 'all' || a.podId === selectedPodId)
                );
                
                // Group achievements by ruleName
                const ruleCounts: Record<string, number> = {};
                compAchievements.forEach(a => {
                  const ruleName = a.ruleName || 'Unknown';
                  ruleCounts[ruleName] = (ruleCounts[ruleName] || 0) + (a.value || 1);
                });

                return (
                  <div
                    key={comp.id}
                    className="flex flex-col p-3 rounded-lg bg-card/50 border border-border/30 hover:bg-card/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm truncate" title={comp.name}>{comp.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {comp.startsAt && format(new Date(comp.startsAt), 'MMM d')} -{' '}
                      {comp.endsAt && format(new Date(comp.endsAt), 'MMM d, yyyy')}
                    </p>
                    <div className="text-xs space-y-0.5 mt-auto">
                      {Object.entries(ruleCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([ruleName, count]) => (
                          <div key={ruleName} className="flex justify-between items-center">
                            <span className="truncate mr-2" title={ruleName}>{ruleName}</span>
                            <span className="font-medium tabular-nums flex-shrink-0">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
