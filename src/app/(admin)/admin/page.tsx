'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Leaderboard } from '@/components/leaderboard';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ShieldCheck, Megaphone, Trophy, BarChart3, AlertCircle, CalendarIcon } from 'lucide-react'; // Added icons
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'; // Added Popover
import { Calendar } from '@/components/ui/calendar'; // Added Calendar
import { Button } from '@/components/ui/button'; // Added Button
import { Label } from '@/components/ui/label'; // Added Label
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'; // Date functions
import { cn } from '@/lib/utils'; // For conditional classes
import type { AppUser } from '@/services/user';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
// Explicitly import DailyAchievementLog type from its definition file
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog'; // Reuse type

// Leaderboard Entry Interface (can be reused or adapted)
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number; // Changed from totalPoints to score to match Leaderboard component prop
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  // Add other relevant fields if needed, e.g., podName for individual leaderboard
}

// Achievement Summary Interface
interface AchievementSummaryEntry {
    ruleName: string;
    emoji: string;
    totalValue: number;
}


// Timeframe options
type Timeframe = 'daily' | 'weekly' | 'monthly' | 'allTime'; // Removed 'custom' for simplicity initially

// Interface for stats card props (remains the same)
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  isLoading: boolean;
  description?: string;
}

function StatCard({ title, value, icon, isLoading, description }: StatCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2 rounded" />
        ) : (
          <div className="text-2xl font-bold text-primary">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        )}
        {description && !isLoading && (
          <p className="text-xs text-muted-foreground pt-1">{description}</p>
        )}
        {isLoading && <Skeleton className="h-3 w-3/4 rounded mt-1" />}
      </CardContent>
    </Card>
  );
}


export default function AdminDashboardPage() {
  // --- State Variables ---
  const [stats, setStats] = useState({ campaigns: 0, pods: 0, users: 0, activeCompetitions: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('weekly'); // Default timeframe
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date())); // Reference date for timeframe calculations
  // State for fetched data
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [allRules, setAllRules] = useState<RuleFormData[]>([]); // Store all rules for summary

  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for leaderboards/summary

  // --- Data Fetching ---

  // Fetch Stats Data (remains largely the same, uses onSnapshot now)
  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];
    setIsLoadingStats(true);
    setError(null);

    try {
        // Campaigns
        const campaignsQuery = query(collection(db, 'campaigns'));
        unsubscribes.push(onSnapshot(campaignsQuery, (snapshot) => {
            setStats(prev => ({ ...prev, campaigns: snapshot.size }));
        }, err => console.error("Error fetching campaigns:", err)));

        // Pods
        const podsQuery = query(collection(db, 'pods'));
        unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
            setStats(prev => ({ ...prev, pods: snapshot.size }));
            // Fetch pods data for leaderboards later
             const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
             setAllPods(fetchedPods);
        }, err => console.error("Error fetching pods:", err)));

        // Users
        const usersQuery = query(collection(db, 'users'));
        unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
            setStats(prev => ({ ...prev, users: snapshot.size }));
             // Fetch users data for leaderboards later
             const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
             setAllUsers(fetchedUsers);
        }, err => console.error("Error fetching users:", err)));

        // Active Competitions
        const competitionsQuery = query(collection(db, 'competitions'));
        unsubscribes.push(onSnapshot(competitionsQuery, (snapshot) => {
            const now = Timestamp.now();
             const fetchedCompetitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
             setAllCompetitions(fetchedCompetitions); // Store all competitions

             const activeCompetitions = fetchedCompetitions.filter(comp =>
                comp.startDate.toDate() <= now.toDate() && comp.endDate.toDate() >= now.toDate()
            ).length;
            setStats(prev => ({ ...prev, activeCompetitions }));
             setIsLoadingStats(false); // Mark stats as loaded after competitions
             setError(null);
        }, err => {
             console.error("Error fetching competitions:", err);
             setError("Failed to load competition data.");
             setIsLoadingStats(false);
        }));

    } catch (err) {
        console.error("Error setting up stat listeners:", err);
        setError("Failed to load dashboard statistics.");
        setIsLoadingStats(false);
    }

     // Fetch all rules (needed for summary) - one-time fetch might be okay here
     const fetchRules = async () => {
         try {
             const rulesSnapshots = await getDocs(collection(db, 'campaignRules'));
             const rules: RuleFormData[] = [];
             rulesSnapshots.forEach(doc => {
                 rules.push(...(doc.data().rules || []));
             });
             // Add rules from competitions as well if they can differ significantly
             const competitionRulesSnapshots = await getDocs(collection(db, 'competitions'));
             competitionRulesSnapshots.forEach(doc => {
                  rules.push(...(doc.data().rules || []));
             });
             // De-duplicate rules based on ID (or name if IDs aren't stable)
             const uniqueRules = Array.from(new Map(rules.map(rule => [rule.id || rule.name, rule])).values());
             setAllRules(uniqueRules);
         } catch (ruleError) {
             console.error("Error fetching rules:", ruleError);
             setError("Failed to load rules data for summary.");
         }
     };
     fetchRules();


    // Cleanup listeners
     return () => unsubscribes.forEach(unsub => unsub());
  }, []);


  // Fetch Achievement Logs based on Timeframe
  useEffect(() => {
      setIsLoadingData(true); // Start loading when timeframe changes
      setError(null);

      let startDate: Date | null = null;
      let endDate: Date | null = endOfDay(selectedDate); // Use selectedDate as end reference for daily/weekly/monthly

      switch (timeframe) {
          case 'daily':
              startDate = startOfDay(selectedDate);
              break;
          case 'weekly':
              startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Assuming week starts Monday
              endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
              break;
          case 'monthly':
              startDate = startOfMonth(selectedDate);
              endDate = endOfMonth(selectedDate);
              break;
           case 'allTime':
              // No date filtering needed
              startDate = null;
              endDate = null;
              break;
          // case 'custom': // Add later if needed
          //     startDate = customStartDate;
          //     endDate = customEndDate;
          //     break;
      }

      const logsRef = collection(db, 'dailyAchievements');
      let q = query(logsRef); // Base query

      // Apply date filters if applicable
      if (startDate && endDate) {
         console.log(`Querying logs from ${startDate.toISOString()} to ${endDate.toISOString()}`);
         q = query(q,
             where('date', '>=', Timestamp.fromDate(startDate)),
             where('date', '<=', Timestamp.fromDate(endDate))
         );
      } else {
         console.log(`Querying all logs`);
      }


      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
          setAchievementLogs(fetchedLogs);
          setIsLoadingData(false);
           setError(null);
      }, (err) => {
          console.error("Error fetching achievement logs:", err);
          setError("Failed to load achievement data for the selected timeframe.");
          setAchievementLogs([]); // Clear logs on error
          setIsLoadingData(false);
      });

      return () => unsubscribe(); // Cleanup log listener

  }, [timeframe, selectedDate]);


  // --- Data Calculation (useMemo) ---
   const { podLeaderboard, individualLeaderboard, achievementSummary } = useMemo(() => {
       if (isLoadingData || allUsers.length === 0) {
            return { podLeaderboard: [], individualLeaderboard: [], achievementSummary: [] };
        }

        // 1. Calculate Individual Scores
        const agentScores: Record<string, number> = {};
         allUsers.forEach(user => { // Initialize all users (could filter by role later)
             if(user.id) agentScores[user.id] = 0;
         });
         achievementLogs.forEach(log => {
            // Ensure log.points is a number, default to 0 if not
            const points = typeof log.points === 'number' ? log.points : 0;
            if (agentScores.hasOwnProperty(log.agentId)) {
                agentScores[log.agentId] += points; // Use sanitized points
            }
        });

        const finalIndividualLeaderboard: LeaderboardEntry[] = allUsers
            .filter(user => user.roles?.includes('agent')) // Consider only agents for individual leaderboard
            .map(agent => ({
                id: agent.id!,
                name: agent.name,
                score: agentScores[agent.id!] || 0, // Use score property and ensure it's a number
                avatarUrl: agent.avatarUrl,
                avatarInitials: agent.avatarInitials,
                avatarBgColor: agent.avatarBgColor,
            }))
            .filter(entry => entry.score > 0) // Optional: Hide agents with 0 points
            .sort((a, b) => b.score - a.score) // Sort by score
            .map((entry, index) => ({ ...entry, rank: index + 1 }));


        // 2. Calculate Pod Scores
        const podScores: Record<string, { name: string; score: number; id: string }> = {};
        allPods.forEach(pod => {
             podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 }; // Initialize score
        });
        achievementLogs.forEach(log => {
             // Ensure log.points is a number, default to 0 if not
             const points = typeof log.points === 'number' ? log.points : 0;
            if (log.podId && podScores[log.podId]) {
                 podScores[log.podId].score += points; // Use sanitized points
            }
        });

        const finalPodLeaderboard: LeaderboardEntry[] = Object.values(podScores)
             .filter(pod => pod.score > 0) // Optional: Hide pods with 0 points
            .sort((a, b) => b.score - a.score) // Sort by score
             .map((entry, index) => {
                const podData = allPods.find(p => p.id === entry.id); // Get full pod data for avatar
                return {
                    ...entry,
                    rank: index + 1,
                    avatarUrl: podData?.logoUrl,
                    avatarInitials: podData?.logoInitials,
                    avatarBgColor: podData?.logoBgColor,
                };
            });


        // 3. Calculate Achievement Summary
        const summary: Record<string, Omit<AchievementSummaryEntry, 'ruleName' | 'emoji'>> = {};
         const ruleDetailsMap = new Map(allRules.map(rule => [rule.id || rule.name, { name: rule.name, emoji: rule.emoji || '❓' }]));

         achievementLogs.forEach(log => {
             const ruleKey = log.ruleId || log.ruleName; // Use ID if available, fallback to name
             if (!summary[ruleKey]) {
                 summary[ruleKey] = { totalValue: 0 };
             }
             // Ensure log.value is a number
             const value = typeof log.value === 'number' ? log.value : 0;
             summary[ruleKey].totalValue += value; // Sum the actual value (not points)
         });

         const finalAchievementSummary: AchievementSummaryEntry[] = Object.entries(summary)
             .map(([key, data]) => {
                 const details = ruleDetailsMap.get(key) || { name: key, emoji: '❓' }; // Find rule details
                 return {
                     ruleName: details.name,
                     emoji: details.emoji,
                     totalValue: data.totalValue,
                 };
             })
             .sort((a, b) => b.totalValue - a.totalValue); // Sort by total value descending

        return {
             podLeaderboard: finalPodLeaderboard,
             individualLeaderboard: finalIndividualLeaderboard,
             achievementSummary: finalAchievementSummary
        };

   }, [achievementLogs, allUsers, allPods, allRules, isLoadingData]);


  const isLoading = isLoadingStats || isLoadingData;

  return (
    <>
      {error && (
         <div className="mb-4 text-center text-destructive bg-destructive/10 p-3 rounded-md flex items-center justify-center gap-2">
           <AlertCircle className="h-4 w-4" /> {error}
          </div>
       )}

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Total Campaigns" value={isLoadingStats ? '-' : stats.campaigns} icon={<Megaphone className="h-4 w-4" />} isLoading={isLoadingStats} description="Active & Past Campaigns" />
        <StatCard title="Total Pods" value={isLoadingStats ? '-' : stats.pods} icon={<ShieldCheck className="h-4 w-4" />} isLoading={isLoadingStats} description="Team Structures" />
        <StatCard title="Total Users" value={isLoadingStats ? '-' : stats.users} icon={<Users className="h-4 w-4" />} isLoading={isLoadingStats} description="Across All Roles" />
        <StatCard title="Active Competitions" value={isLoadingStats ? '-' : stats.activeCompetitions} icon={<Trophy className="h-4 w-4" />} isLoading={isLoadingStats} description="Currently Running" />
      </div>

      {/* Timeframe Selection */}
       <Card className="mb-6">
        <CardHeader>
          <CardTitle>Leaderboard & Summary Timeframe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
             <div className="grid gap-1.5">
              <Label htmlFor="timeframe-select">Select Period</Label>
              <Select onValueChange={(value) => setTimeframe(value as Timeframe)} value={timeframe} disabled={isLoading}>
                <SelectTrigger id="timeframe-select" className="w-[180px]">
                  <SelectValue placeholder="Select Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Today</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                   {/* <SelectItem value="custom">Custom</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
             {/* Date Picker (Only relevant for daily/weekly/monthly) */}
            {(timeframe === 'daily' || timeframe === 'weekly' || timeframe === 'monthly') && (
              <div className="grid gap-1.5">
                <Label htmlFor="date-select">Reference Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date-select"
                            variant={"outline"}
                            className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                            disabled={isLoading}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                            initialFocus
                        />
                    </PopoverContent>
                 </Popover>
              </div>
            )}
             {/* TODO: Add Custom Date Range Pickers if 'custom' timeframe is enabled */}
        </CardContent>
      </Card>


       {/* Leaderboards and Achievement Summary */}
       <div className="grid gap-6 lg:grid-cols-3">
           {/* Pod Leaderboard */}
           <div className="lg:col-span-1">
              {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
              ) : podLeaderboard.length === 0 ? (
                 <Card className="h-[400px] flex items-center justify-center">
                     <CardContent className="text-center text-muted-foreground">
                         <p>No pod data available for this period.</p>
                     </CardContent>
                 </Card>
              ) : (
                  <Leaderboard title="Pod Leaderboard" entries={podLeaderboard} description={`Ranking based on ${timeframe} points`} />
              )}
           </div>

           {/* Individual Leaderboard */}
           <div className="lg:col-span-1">
              {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
              ) : individualLeaderboard.length === 0 ? (
                  <Card className="h-[400px] flex items-center justify-center">
                     <CardContent className="text-center text-muted-foreground">
                         <p>No individual agent data available for this period.</p>
                     </CardContent>
                 </Card>
              ) : (
                <Leaderboard title="Agent Leaderboard" entries={individualLeaderboard} description={`Top agents by ${timeframe} points`} />
              )}
           </div>

            {/* Achievement Summary */}
           <div className="lg:col-span-1">
              <Card className="h-[400px] flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Achievement Summary</CardTitle>
                  <CardDescription>Total counts for each rule in the selected timeframe ({timeframe}).</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto">
                  {isLoading ? (
                      <div className="space-y-3">
                          <Skeleton className="h-6 w-full rounded" />
                          <Skeleton className="h-6 w-full rounded" />
                          <Skeleton className="h-6 w-5/6 rounded" />
                          <Skeleton className="h-6 w-3/4 rounded" />
                      </div>
                  ) : achievementSummary.length === 0 ? (
                     <p className="text-muted-foreground text-center py-4">No achievements logged in this period.</p>
                  ) : (
                    <ul className="space-y-3">
                      {achievementSummary.map((summary, index) => (
                        <li key={index} className="flex items-center justify-between text-sm">
                           <span className="flex items-center gap-2 truncate" title={summary.ruleName}>
                               <span className="text-lg">{summary.emoji}</span>
                               <span className="truncate">{summary.ruleName}</span>
                           </span>
                          <span className="font-semibold text-primary">{summary.totalValue.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
           </div>
       </div>
    </>
  );
}