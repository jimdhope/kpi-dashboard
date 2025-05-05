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
import { Form } from '@/components/ui/form'; // Added Form import
import { useForm } from 'react-hook-form'; // Import useForm
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns'; // Import addDays
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
type Timeframe = 'daily' | 'weekly' | 'monthly' | 'allTime';

// --- Removed StatCard component definition ---

export default function AdminDashboardPage() {
  // --- State Variables ---
  // Removed stats and isLoadingStats state
  const [error, setError] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('weekly'); // Default timeframe
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfDay(new Date())); // Default to today
  // State for fetched data
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]); // No longer used for stats, keep for rules?
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [allRules, setAllRules] = useState<RuleFormData[]>([]); // Store all rules for summary

  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for leaderboards/summary

  // Initialize react-hook-form - needed for Form context (can be simplified if Form not used)
   const form = useForm(); // Minimal form setup

  // --- Data Fetching ---

  // Removed useEffect hook for fetching Stats Data

  // Fetch base data (Users, Pods, Rules, Competitions - needed for rules/context)
  useEffect(() => {
    setIsLoadingData(true);
    const unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const fetchBaseData = async () => {
        setError(null);
        try {
            // Fetch Pods
            const podsQuery = query(collection(db, 'pods'), orderBy('name'));
            unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
                if (!isMounted) return;
                setAllPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
            }, err => { if (isMounted) console.error("Error fetching pods:", err); }));

            // Fetch Users
            const usersQuery = query(collection(db, 'users'), orderBy('name'));
            unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
                if (!isMounted) return;
                setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
            }, err => { if (isMounted) console.error("Error fetching users:", err); }));

            // Fetch Competitions (Still needed for rule context potentially)
            const compQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
            unsubscribes.push(onSnapshot(compQuery, (snapshot) => {
                if (!isMounted) return;
                setAllCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
            }, err => { if (isMounted) console.error("Error fetching competitions:", err); }));

             // Fetch all rules (needed for summary)
             const rulesSnapshots = await getDocs(collection(db, 'campaignRules'));
             const rules: RuleFormData[] = [];
             rulesSnapshots.forEach(doc => {
                 rules.push(...(doc.data().rules || []));
             });
             const competitionRulesSnapshots = await getDocs(collection(db, 'competitions'));
             competitionRulesSnapshots.forEach(doc => {
                  rules.push(...(doc.data().rules || []));
             });
             const uniqueRules = Array.from(new Map(rules.map(rule => [rule.id || rule.name, rule])).values());
             setAllRules(uniqueRules);

        } catch (err) {
             if (isMounted) {
                console.error("Error fetching base data:", err);
                setError("Failed to load necessary dashboard data.");
             }
        }
        // Note: setIsLoadingData(false) is handled in the achievementLogs useEffect
    };

    fetchBaseData();

    return () => {
        isMounted = false;
        unsubscribes.forEach(unsub => unsub());
    };
  }, []);


  // Fetch Achievement Logs based on Timeframe (remains the same)
  useEffect(() => {
      setIsLoadingData(true); // Start loading when timeframe or date changes
      setError(null);

      let startDate: Date | null = null;
      let endDate: Date | null = null;
      // Use today's date if no specific date selected for daily, weekly, monthly
       const referenceDate = selectedDate || startOfDay(new Date());

       console.log(`Timeframe: ${timeframe}, Reference Date: ${referenceDate.toISOString()}`);

      switch (timeframe) {
          case 'daily':
              startDate = startOfDay(referenceDate);
              endDate = endOfDay(referenceDate);
              break;
          case 'weekly':
              // Calculate 7 days starting FROM the referenceDate
              startDate = startOfDay(referenceDate);
              endDate = endOfDay(addDays(referenceDate, 6)); // Add 6 days to get a 7-day period
              break;
          case 'monthly':
              // Use start/end of the month containing the referenceDate
              startDate = startOfMonth(referenceDate);
              endDate = endOfMonth(referenceDate);
              break;
           case 'allTime':
              startDate = null;
              endDate = null;
              break;
      }

      const logsRef = collection(db, 'dailyAchievements');
      let q = query(logsRef);

      if (startDate && endDate) {
         console.log(`Querying logs from ${startDate.toISOString()} to ${endDate.toISOString()}`);
         q = query(q,
             where('date', '>=', Timestamp.fromDate(startDate)),
             where('date', '<=', Timestamp.fromDate(endDate))
         );
      } else if (timeframe === 'allTime') {
          console.log(`Querying all logs`);
      } else {
           console.warn("Invalid date range or timeframe combination.");
           setAchievementLogs([]);
           setIsLoadingData(false);
           return () => {}; // No listener to unsubscribe from
      }


      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
          console.log(`Fetched ${fetchedLogs.length} logs for the timeframe.`);
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

  }, [timeframe, selectedDate]); // Dependencies: re-run when timeframe or selectedDate changes


  // --- Data Calculation (useMemo) - remains the same ---
   const { podLeaderboard, individualLeaderboard, achievementSummary } = useMemo(() => {
       // Return empty arrays if still loading base data (users, pods, rules)
       if (isLoadingData || allUsers.length === 0 || allPods.length === 0 || allRules.length === 0) {
            return { podLeaderboard: [], individualLeaderboard: [], achievementSummary: [] };
        }

        // --- Individual Scores ---
        const agentScores: Record<string, number> = {};
         allUsers.forEach(user => {
             if(user.id) agentScores[user.id] = 0;
         });
         achievementLogs.forEach(log => {
            const points = typeof log.points === 'number' ? log.points : 0;
            if (agentScores.hasOwnProperty(log.agentId)) {
                agentScores[log.agentId] += points;
            }
        });

        const finalIndividualLeaderboard: LeaderboardEntry[] = allUsers
            .filter(user => user.roles?.includes('agent'))
            .map(agent => ({
                id: agent.id!,
                name: agent.name,
                score: agentScores[agent.id!] || 0,
                avatarUrl: agent.avatarUrl,
                avatarInitials: agent.avatarInitials,
                avatarBgColor: agent.avatarBgColor,
            }))
             .sort((a, b) => b.score - a.score)
             .map((entry, index) => ({ ...entry, rank: index + 1 }));

        // --- Pod Scores ---
        const podScores: Record<string, { name: string; score: number; id: string }> = {};
        allPods.forEach(pod => {
             podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 };
        });
        achievementLogs.forEach(log => {
             const points = typeof log.points === 'number' ? log.points : 0;
            if (log.podId && podScores[log.podId]) {
                 podScores[log.podId].score += points;
            }
        });

        const finalPodLeaderboard: LeaderboardEntry[] = Object.values(podScores)
            .sort((a, b) => b.score - a.score)
             .map((entry, index) => {
                const podData = allPods.find(p => p.id === entry.id);
                return {
                    ...entry,
                    rank: index + 1,
                    avatarUrl: podData?.logoUrl,
                    avatarInitials: podData?.logoInitials,
                    avatarBgColor: podData?.logoBgColor,
                };
            });

        // --- Achievement Summary ---
        const summary: Record<string, Omit<AchievementSummaryEntry, 'ruleName' | 'emoji'>> = {};
         const ruleDetailsMap = new Map(allRules.map(rule => [rule.id || rule.name, { name: rule.name, emoji: rule.emoji || '❓' }]));

         achievementLogs.forEach(log => {
             const ruleKey = log.ruleId || log.ruleName;
             if (!summary[ruleKey]) {
                 summary[ruleKey] = { totalValue: 0 };
             }
             const value = typeof log.value === 'number' ? log.value : 0;
             summary[ruleKey].totalValue += value;
         });

         const finalAchievementSummary: AchievementSummaryEntry[] = Object.entries(summary)
             .map(([key, data]) => {
                 const details = ruleDetailsMap.get(key) || { name: key, emoji: '❓' };
                 return {
                     ruleName: details.name,
                     emoji: details.emoji,
                     totalValue: data.totalValue,
                 };
             })
             .sort((a, b) => b.totalValue - a.totalValue);

        return {
             podLeaderboard: finalPodLeaderboard,
             individualLeaderboard: finalIndividualLeaderboard,
             achievementSummary: finalAchievementSummary
        };

   }, [achievementLogs, allUsers, allPods, allRules, isLoadingData]);


   const isLoading = isLoadingData; // Use isLoadingData which covers logs and base data dependencies
  const displayDate = selectedDate || startOfDay(new Date()); // Use selected date or today for display


  return (
    <>
      {error && (
         <div className="mb-4 text-center text-destructive bg-destructive/10 p-3 rounded-md flex items-center justify-center gap-2">
           <AlertCircle className="h-4 w-4" /> {error}
          </div>
       )}

      {/* --- Removed Stats Cards --- */}

      {/* Filters Section */}
      <Card className="mb-6">
          <CardHeader>
             <CardTitle>Filters</CardTitle> {/* Changed Title */}
             <CardDescription>Select the time period for the leaderboards and summary.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
             {/* Timeframe Select */}
             <div className="grid gap-1.5">
                 <Label htmlFor="timeframe-select">Select Period</Label>
                 <Select onValueChange={(value) => setTimeframe(value as Timeframe)} value={timeframe} disabled={isLoading}>
                     <SelectTrigger id="timeframe-select" className="w-[180px]">
                         <SelectValue placeholder="Select Timeframe" />
                     </SelectTrigger>
                     <SelectContent>
                         <SelectItem value="daily">Daily</SelectItem>
                         <SelectItem value="weekly">Weekly</SelectItem>
                         <SelectItem value="monthly">Monthly</SelectItem>
                         <SelectItem value="allTime">All Time</SelectItem>
                     </SelectContent>
                 </Select>
             </div>
              {/* Start Date Picker */}
              <div className="grid gap-1.5">
                 <Label htmlFor="date-select">Start Date</Label>
                 <Popover>
                     <PopoverTrigger asChild>
                         <Button
                             id="date-select"
                             variant={"outline"}
                             className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                             disabled={isLoading || timeframe === 'allTime'} // Disable for 'allTime'
                         >
                             <CalendarIcon className="mr-2 h-4 w-4" />
                             {displayDate ? format(displayDate, "PPP") : <span>Pick a date</span>}
                         </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-auto p-0 z-50">
                         <Calendar
                             mode="single"
                             selected={selectedDate}
                             onSelect={(date) => setSelectedDate(date ? startOfDay(date) : undefined)}
                             initialFocus
                             disabled={timeframe === 'allTime'}
                         />
                     </PopoverContent>
                 </Popover>
                 {/* Removed FormDescription */}
              </div>
              {/* Removed Custom Date Range Pickers */}
          </CardContent>
      </Card>

      {/* Leaderboards and Achievement Summary */}
       <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3"> {/* Adjust grid for new layout */}

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

           {/* Achievement Summary Cards */}
           <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 gap-6 self-start"> {/* New summary section */}
               {isLoading ? (
                   <>
                       <Skeleton className="h-[120px] w-full" />
                       <Skeleton className="h-[120px] w-full" />
                       <Skeleton className="h-[120px] w-full" />
                       <Skeleton className="h-[120px] w-full" />
                   </>
               ) : achievementSummary.length === 0 ? (
                  <Card className="sm:col-span-2 h-[400px] flex items-center justify-center">
                      <CardContent className="text-center text-muted-foreground">
                           <p>No achievements logged in this period.</p>
                       </CardContent>
                  </Card>
               ) : (
                   achievementSummary.map((summary, index) => (
                       <Card key={index} className="shadow-sm">
                           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                               <CardTitle className="text-sm font-medium truncate" title={summary.ruleName}>
                                   {summary.ruleName}
                               </CardTitle>
                               <span className="text-lg">{summary.emoji}</span>
                           </CardHeader>
                           <CardContent>
                               <div className="text-2xl font-bold text-primary">
                                   {summary.totalValue.toLocaleString()}
                               </div>
                               <CardDescription>Total Count</CardDescription>
                           </CardContent>
                       </Card>
                   ))
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

       </div>
    </>
  );
}
