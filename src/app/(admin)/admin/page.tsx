
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Leaderboard } from '@/components/leaderboard';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ShieldCheck, Megaphone, Trophy, BarChart3, AlertCircle, CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Form } from '@/components/ui/form'; // Ensure Form is imported if useForm is used with it
import { useForm } from 'react-hook-form';
import { format, startOfDay, endOfDay, startOfWeek, endOfMonth, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/services/user';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';

// Leaderboard Entry Interface
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean; // To highlight the current user/pod
}

// Achievement Summary Interface
interface AchievementSummaryEntry {
    ruleName: string;
    emoji: string;
    totalValue: number;
}


// Timeframe options
type Timeframe = 'daily' | 'weekly' | 'monthly' | 'allTime';

const ADMIN_DASHBOARD_TIMEFRAME_KEY = 'adminDashboard_timeframe';
const ADMIN_DASHBOARD_SELECTED_DATE_KEY = 'adminDashboard_selectedDate';


export default function AdminDashboardPage() {
  // --- State Variables ---
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [allRules, setAllRules] = useState<RuleFormData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

   const form = useForm(); // Initialize useForm

    // Load saved filters from localStorage on mount
    React.useEffect(() => {
        const savedTimeframe = localStorage.getItem(ADMIN_DASHBOARD_TIMEFRAME_KEY) as Timeframe | null;
        if (savedTimeframe) {
            setTimeframe(savedTimeframe);
        }
        const savedDateString = localStorage.getItem(ADMIN_DASHBOARD_SELECTED_DATE_KEY);
        if (savedDateString) {
            const date = new Date(savedDateString);
            if (!isNaN(date.getTime())) {
                setSelectedDate(startOfDay(date));
            }
        }
    }, []);


  // Fetch base data (Users, Pods, Rules)
  useEffect(() => {
    setIsLoadingData(true);
    const unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const fetchBaseData = async () => {
        setError(null);
        try {
            const podsQuery = query(collection(db, 'pods'), orderBy('name'));
            unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
                if (!isMounted) return;
                setAllPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
            }, err => { if (isMounted) console.error("Error fetching pods:", err); }));

            const usersQuery = query(collection(db, 'users'), orderBy('name'));
            unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
                if (!isMounted) return;
                setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
            }, err => { if (isMounted) console.error("Error fetching users:", err); }));

             const rulesPromises = [
                getDocs(collection(db, 'campaignRules')),
                getDocs(collection(db, 'competitions')) // Competitions also store rules
            ];
            const [campaignRulesSnapshots, competitionDocsSnapshots] = await Promise.all(rulesPromises);
            const rules: RuleFormData[] = [];
            campaignRulesSnapshots.forEach(doc => {
                 rules.push(...(doc.data().rules || []).map((r: any) => ({...r, id: r.id || `rule-${Math.random().toString(36).substr(2, 9)}` })));
            });
            competitionDocsSnapshots.forEach(doc => {
                rules.push(...(doc.data().rules || []).map((r: any) => ({...r, id: r.id || `rule-${Math.random().toString(36).substr(2, 9)}` })));
            });
            // Deduplicate rules by ID, or by name if ID is missing (though ID should be preferred)
            const uniqueRulesMap = new Map<string, RuleFormData>();
            rules.forEach(rule => {
                const key = rule.id || rule.name; // Prefer ID, fallback to name
                if (!uniqueRulesMap.has(key)) {
                    uniqueRulesMap.set(key, rule);
                }
            });
            setAllRules(Array.from(uniqueRulesMap.values()));


        } catch (err) {
             if (isMounted) {
                console.error("Error fetching base data:", err);
                setError("Failed to load necessary dashboard data.");
             }
        }
    };

    fetchBaseData();

    return () => {
        isMounted = false;
        unsubscribes.forEach(unsub => unsub());
    };
  }, []);


  // Fetch Achievement Logs based on Timeframe and selectedDate
  useEffect(() => {
      setIsLoadingData(true);
      setError(null);

      let startDate: Date | null = null;
      let endDate: Date | null = null;
      const referenceDate = selectedDate || startOfDay(new Date());
      console.log(`Timeframe: ${timeframe}, Reference Date: ${referenceDate.toISOString()}`);

      switch (timeframe) {
          case 'daily':
              startDate = startOfDay(referenceDate);
              endDate = endOfDay(referenceDate);
              break;
          case 'weekly':
              startDate = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Assuming week starts on Monday
              endDate = endOfDay(addDays(startDate, 6));
              break;
          case 'monthly':
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
           return () => {};
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
          setAchievementLogs([]);
          setIsLoadingData(false);
      });

      return () => unsubscribe();

  }, [timeframe, selectedDate]);


   const { podLeaderboard, individualLeaderboard, achievementSummary } = useMemo(() => {
       if (isLoadingData || allUsers.length === 0 || allPods.length === 0 || allRules.length === 0) {
            return { podLeaderboard: [], individualLeaderboard: [], achievementSummary: [] };
        }

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


   const isLoading = isLoadingData;
   const displayDate = selectedDate || startOfDay(new Date());


  return (
    <Form {...form}>
      {error && (
         <div className="mb-4 text-center text-destructive bg-destructive/10 p-3 rounded-md flex items-center justify-center gap-2">
           <AlertCircle className="h-4 w-4" /> {error}
          </div>
       )}

      <Card className="mb-6 frosted-glass">
          <CardHeader>
             <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
             <div className="grid gap-1.5">
                 <Label htmlFor="timeframe-select">Select Period</Label>
                 <Select
                    onValueChange={(value) => {
                        setTimeframe(value as Timeframe);
                        localStorage.setItem(ADMIN_DASHBOARD_TIMEFRAME_KEY, value);
                    }}
                    value={timeframe}
                    disabled={isLoading}
                 >
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
              <div className="grid gap-1.5">
                 <Label htmlFor="date-select">Start Date</Label>
                 <Popover>
                     <PopoverTrigger asChild>
                         <Button
                             id="date-select"
                             variant={"outline"}
                             className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                             disabled={isLoading || timeframe === 'allTime'}
                         >
                             <CalendarIcon className="mr-2 h-4 w-4" />
                             {displayDate ? format(displayDate, "PPP") : <span>Pick a date</span>}
                         </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-auto p-0 z-50">
                         <Calendar
                             mode="single"
                             selected={selectedDate}
                             onSelect={(date) => {
                                 const newDate = date ? startOfDay(date) : undefined;
                                 setSelectedDate(newDate);
                                 if (newDate) {
                                     localStorage.setItem(ADMIN_DASHBOARD_SELECTED_DATE_KEY, newDate.toISOString());
                                 } else {
                                     localStorage.removeItem(ADMIN_DASHBOARD_SELECTED_DATE_KEY);
                                 }
                             }}
                             initialFocus
                             disabled={timeframe === 'allTime'}
                         />
                     </PopoverContent>
                 </Popover>
              </div>
          </CardContent>
      </Card>

        <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight mb-4">Achievement Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    <>
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                    </>
                ) : achievementSummary.length === 0 ? (
                <Card className="sm:col-span-full h-[120px] flex items-center justify-center frosted-glass">
                    <CardContent className="text-center text-muted-foreground">
                        <p>No achievements logged in this period.</p>
                    </CardContent>
                </Card>
                ) : (
                    achievementSummary.map((summary, index) => (
                        <Card key={index} className="shadow-sm frosted-glass">
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
        </div>

       <div className="grid gap-6 md:grid-cols-2">
           <div >
              {isLoading ? (
                  <Skeleton className="h-[400px] w-full frosted-glass" />
              ) : podLeaderboard.length === 0 ? (
                 <Card className="h-[400px] flex items-center justify-center frosted-glass">
                     <CardContent className="text-center text-muted-foreground">
                         <p>No pod data available for this period.</p>
                     </CardContent>
                 </Card>
              ) : (
                  <Leaderboard title="Pod Leaderboard" entries={podLeaderboard} description={`Ranking based on ${timeframe} points`} />
              )}
           </div>

           <div >
              {isLoading ? (
                  <Skeleton className="h-[400px] w-full frosted-glass" />
              ) : individualLeaderboard.length === 0 ? (
                  <Card className="h-[400px] flex items-center justify-center frosted-glass">
                     <CardContent className="text-center text-muted-foreground">
                         <p>No individual agent data available for this period.</p>
                     </CardContent>
                 </Card>
              ) : (
                <Leaderboard title="Agent Leaderboard" entries={individualLeaderboard} description={`Top agents by ${timeframe} points`} />
              )}
           </div>
       </div>
    </Form>
  );
}

