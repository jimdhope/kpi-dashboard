
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Leaderboard } from '@/components/leaderboard';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ShieldCheck, Megaphone, Trophy, BarChart3, AlertCircle, CalendarIcon, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Form, useFormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/services/user';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// Leaderboard Entry Interface
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isCurrentUser?: boolean;
}

// Achievement Summary Interface
interface AchievementSummaryEntry {
    ruleName: string;
    emoji: string;
    totalValue: number;
}

// Filter type
type FilterType = 'competition' | 'date';

const ADMIN_DASHBOARD_FILTER_TYPE_KEY = 'adminDashboard_filterType';
const ADMIN_DASHBOARD_SELECTED_COMP_KEY = 'adminDashboard_selectedCompetitionId';
const ADMIN_DASHBOARD_SELECTED_DATE_KEY = 'adminDashboard_selectedDate';


export default function AdminDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('competition');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [selectedCompetitionIdForFilter, setSelectedCompetitionIdForFilter] = useState<string>('');
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [allRules, setAllRules] = useState<RuleFormData[]>([]);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const form = useForm();

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const savedFilterType = localStorage.getItem(ADMIN_DASHBOARD_FILTER_TYPE_KEY) as FilterType | null;
    if (savedFilterType) {
        setFilterType(savedFilterType);
    }
    const savedCompId = localStorage.getItem(ADMIN_DASHBOARD_SELECTED_COMP_KEY);
    if (savedCompId) {
        setSelectedCompetitionIdForFilter(savedCompId);
    }
    const savedDateString = localStorage.getItem(ADMIN_DASHBOARD_SELECTED_DATE_KEY);
    if (savedDateString) {
        const date = new Date(savedDateString);
        if (!isNaN(date.getTime())) {
            setSelectedDate(startOfDay(date));
        }
    }
  }, []);


  // Fetch base data (Users, Pods, Competitions, Rules)
  useEffect(() => {
    setIsLoadingBaseData(true);
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

            const competitionsQuery = query(collection(db, 'competitions'), orderBy('name'));
            unsubscribes.push(onSnapshot(competitionsQuery, (snapshot) => {
                if (!isMounted) return;
                setAllCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
            }, err => { if (isMounted) console.error("Error fetching competitions:", err); }));

            const rulesPromises = [
                getDocs(collection(db, 'campaignRules')),
                getDocs(collection(db, 'competitions'))
            ];
            const [campaignRulesSnapshots, competitionDocsSnapshots] = await Promise.all(rulesPromises);
            const rules: RuleFormData[] = [];
            campaignRulesSnapshots.forEach(doc => {
                 rules.push(...(doc.data().rules || []).map((r: any) => ({...r, id: r.id || `rule-${Math.random().toString(36).substr(2, 9)}` })));
            });
            competitionDocsSnapshots.forEach(doc => {
                rules.push(...(doc.data().rules || []).map((r: any) => ({...r, id: r.id || `rule-${Math.random().toString(36).substr(2, 9)}` })));
            });
            const uniqueRulesMap = new Map<string, RuleFormData>();
            rules.forEach(rule => {
                const key = rule.id || rule.name;
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
        } finally {
            if (isMounted) setIsLoadingBaseData(false);
        }
    };

    fetchBaseData();

    return () => {
        isMounted = false;
        unsubscribes.forEach(unsub => unsub());
    };
  }, []);


  // Fetch Achievement Logs based on selected filters
  useEffect(() => {
      if (isLoadingBaseData) return; // Wait for base data, especially allCompetitions

      setIsLoadingLogs(true);
      setError(null);
      setAchievementLogs([]); // Clear previous logs

      const logsRef = collection(db, 'dailyAchievements');
      let q = query(logsRef);
      let shouldFetch = false;

      if (filterType === 'competition' && selectedCompetitionIdForFilter) {
          const competition = allCompetitions.find(c => c.id === selectedCompetitionIdForFilter);
          if (competition) {
              q = query(q, where('competitionId', '==', selectedCompetitionIdForFilter));
              // Optionally, if competition has start/end dates, you can add them here
              // This is generally good practice to limit the scope of the query further
              // if (competition.startDate) q = query(q, where('date', '>=', competition.startDate));
              // if (competition.endDate) q = query(q, where('date', '<=', competition.endDate));
              shouldFetch = true;
          } else {
              console.warn("Selected competition not found in allCompetitions list.");
          }
      } else if (filterType === 'date' && selectedDate) {
          const startDateQuery = Timestamp.fromDate(startOfDay(selectedDate));
          const endDateQuery = Timestamp.fromDate(endOfDay(selectedDate));
          q = query(q, where('date', '>=', startDateQuery), where('date', '<=', endDateQuery));
          shouldFetch = true;
      }

      if (!shouldFetch) {
          setIsLoadingLogs(false);
          return () => {};
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
          setAchievementLogs(fetchedLogs);
          setIsLoadingLogs(false);
          setError(null);
      }, (err) => {
          console.error("Error fetching achievement logs:", err);
          setError("Failed to load achievement data for the selected filter.");
          setAchievementLogs([]);
          setIsLoadingLogs(false);
      });

      return () => unsubscribe();

  }, [filterType, selectedCompetitionIdForFilter, selectedDate, allCompetitions, isLoadingBaseData]);


   const { podLeaderboard, individualLeaderboard, achievementSummary } = useMemo(() => {
       if (isLoadingBaseData || isLoadingLogs || allUsers.length === 0 || allPods.length === 0 || allRules.length === 0) {
            return { podLeaderboard: [], individualLeaderboard: [], achievementSummary: [] };
        }

        // Agent scores (used for individual leaderboard)
        const agentScores: Record<string, number> = {};
        allUsers.forEach(user => {
             if(user.id) agentScores[user.id] = 0;
        });
        achievementLogs.forEach(log => { // These logs are already filtered
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
            .map((entry, index, arr) => {
                 // Dense ranking: if score is same as previous, rank is same
                 const rank = (index > 0 && entry.score === arr[index - 1].score)
                     ? (arr[index-1].rank ?? index + 1)
                     : index + 1;
                 return { ...entry, rank };
             });


        // Pod scores (used for pod leaderboard)
        const podScores: Record<string, { name: string; score: number; id: string }> = {};
        allPods.forEach(pod => {
             podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 };
        });
        achievementLogs.forEach(log => { // These logs are already filtered
            const points = typeof log.points === 'number' ? log.points : 0;
            if (log.podId && podScores[log.podId]) {
                 podScores[log.podId].score += points;
            }
        });

        const finalPodLeaderboard: LeaderboardEntry[] = Object.values(podScores)
            .sort((a, b) => b.score - a.score)
            .map((entry, index, arr) => {
                const podData = allPods.find(p => p.id === entry.id);
                const rank = (index > 0 && entry.score === arr[index - 1].score)
                    ? (arr[index-1].rank ?? index + 1)
                    : index + 1;
                return {
                    ...entry,
                    rank: rank,
                    avatarUrl: podData?.logoUrl,
                    avatarInitials: podData?.logoInitials,
                    avatarBgColor: podData?.logoBgColor,
                };
            });

        // Achievement Summary
        const summary: Record<string, Omit<AchievementSummaryEntry, 'ruleName' | 'emoji'>> = {};
        // Use rule details from the logs themselves, or fall back to allRules for canonical names/emojis if only ID is present
        const ruleDetailsMap = new Map(allRules.map(rule => [rule.id || rule.name, { name: rule.name, emoji: rule.emoji || '❓' }]));

        achievementLogs.forEach(log => { // These logs are already filtered
             const ruleKey = log.ruleId || log.ruleName; // Prefer ID if available
             if (!summary[ruleKey]) {
                 summary[ruleKey] = { totalValue: 0 };
             }
             const value = typeof log.value === 'number' ? log.value : 0;
             summary[ruleKey].totalValue += value;
        });

        const finalAchievementSummary: AchievementSummaryEntry[] = Object.entries(summary)
            .map(([key, data]) => {
                 // Try to get name/emoji from the first log entry for this rule, or fallback to allRules map
                 const firstLogForRule = achievementLogs.find(log => (log.ruleId || log.ruleName) === key);
                 const name = firstLogForRule?.ruleName || ruleDetailsMap.get(key)?.name || key;
                 const emoji = firstLogForRule?.emoji || ruleDetailsMap.get(key)?.emoji || '❓';
                 return {
                     ruleName: name,
                     emoji: emoji,
                     totalValue: data.totalValue,
                 };
            })
            .sort((a, b) => b.totalValue - a.totalValue);

        return {
             podLeaderboard: finalPodLeaderboard,
             individualLeaderboard: finalIndividualLeaderboard,
             achievementSummary: finalAchievementSummary
        };

   }, [achievementLogs, allUsers, allPods, allRules, isLoadingBaseData, isLoadingLogs]);


   const isLoading = isLoadingBaseData || isLoadingLogs;

  return (
    <Form {...form}>
      {error && (
         <div className="mb-4 text-center text-destructive bg-destructive/10 p-3 rounded-md flex items-center justify-center gap-2">
           <AlertCircle className="h-4 w-4" /> {error}
          </div>
       )}

      <Card className="mb-6 frosted-glass">
          <CardHeader>
             <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="grid gap-1.5">
                    <Label htmlFor="filter-type-select">Filter By</Label>
                    <Select
                    onValueChange={(value) => {
                        setFilterType(value as FilterType);
                        localStorage.setItem(ADMIN_DASHBOARD_FILTER_TYPE_KEY, value);
                        // Reset other filters when type changes
                        if (value === 'date') {
                            setSelectedCompetitionIdForFilter('');
                            localStorage.removeItem(ADMIN_DASHBOARD_SELECTED_COMP_KEY);
                            if (!selectedDate) setSelectedDate(startOfDay(new Date())); // Default to today if no date selected
                        } else {
                            // setSelectedDate(undefined); // Clear date if switching to competition
                            // localStorage.removeItem(ADMIN_DASHBOARD_SELECTED_DATE_KEY);
                        }
                    }}
                    value={filterType}
                    disabled={isLoading}
                    >
                    <SelectTrigger id="filter-type-select">
                        <SelectValue placeholder="Select Filter Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="competition">Competition</SelectItem>
                        <SelectItem value="date">Specific Date</SelectItem>
                    </SelectContent>
                    </Select>
                </div>

                {filterType === 'competition' && (
                    <div className="grid gap-1.5 md:col-span-2"> {/* Allow competition select to span more width */}
                        <Label htmlFor="competition-filter-select">Select Competition</Label>
                        <Select
                            onValueChange={(value) => {
                            setSelectedCompetitionIdForFilter(value);
                            localStorage.setItem(ADMIN_DASHBOARD_SELECTED_COMP_KEY, value);
                            }}
                            value={selectedCompetitionIdForFilter}
                            disabled={isLoading || allCompetitions.length === 0}
                        >
                            <SelectTrigger id="competition-filter-select">
                            <SelectValue placeholder="Select a Competition" />
                            </SelectTrigger>
                            <SelectContent>
                            {allCompetitions.length === 0 && !isLoading && <SelectItem value="-" disabled>No competitions found</SelectItem>}
                            {isLoadingBaseData && <SelectItem value="-" disabled>Loading competitions...</SelectItem>}
                            {allCompetitions.map(comp => (
                                <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {filterType === 'date' && (
                    <div className="grid gap-1.5">
                        <Label htmlFor="date-filter-select">Select Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date-filter-select"
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                                disabled={isLoading}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
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
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </div>
          </CardContent>
      </Card>

        <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight mb-4">Achievement Summary</h2>
            <CardDescription className="mb-4">
                {filterType === 'competition' && selectedCompetitionIdForFilter && allCompetitions.find(c=>c.id === selectedCompetitionIdForFilter) ?
                    `Showing summary for competition: "${allCompetitions.find(c=>c.id === selectedCompetitionIdForFilter)?.name}"` :
                filterType === 'date' && selectedDate ?
                    `Showing summary for date: ${format(selectedDate, "PPP")}` :
                "Select a filter to view summary."
                }
            </CardDescription>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    <>
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                        <Skeleton className="h-[120px] w-full frosted-glass" />
                    </>
                ) : achievementSummary.length === 0 && (filterType === 'competition' && selectedCompetitionIdForFilter || filterType === 'date' && selectedDate) ? (
                <Card className="sm:col-span-full h-[120px] flex items-center justify-center frosted-glass">
                    <CardContent className="text-center text-muted-foreground">
                        <p>No achievements logged for the selected filter.</p>
                    </CardContent>
                </Card>
                ) : achievementSummary.length > 0 ? (
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
                ) : (
                    <Card className="sm:col-span-full h-[120px] flex items-center justify-center frosted-glass">
                        <CardContent className="text-center text-muted-foreground">
                            <p>Please select a competition or a date to view the summary.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>

       <div className="grid gap-6 md:grid-cols-2">
           <Card className="frosted-glass shadow-md">
              <CardHeader>
                  <CardTitle>Pod Leaderboard</CardTitle>
                   <CardDescription>
                        {filterType === 'competition' && selectedCompetitionIdForFilter && allCompetitions.find(c=>c.id === selectedCompetitionIdForFilter) ?
                            `Ranking for competition: "${allCompetitions.find(c=>c.id === selectedCompetitionIdForFilter)?.name}"` :
                        filterType === 'date' && selectedDate ?
                            `Ranking for date: ${format(selectedDate, "PPP")}` :
                        "Select a filter."
                        }
                   </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(100vh-350px)]">
                  {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                  ) : podLeaderboard.length === 0 && (filterType === 'competition' && selectedCompetitionIdForFilter || filterType === 'date' && selectedDate) ? (
                      <p className="text-muted-foreground text-center py-4">No pod data available for this filter.</p>
                  ) : podLeaderboard.length > 0 ? (
                      <Leaderboard entries={podLeaderboard} isStickyHeader={true} />
                  ): (
                      <p className="text-muted-foreground text-center py-4">Select a filter to view pod leaderboard.</p>
                  )}
              </CardContent>
            </Card>

           <Card className="frosted-glass shadow-md">
              <CardHeader>
                  <CardTitle>Agent Leaderboard</CardTitle>
                  <CardDescription>
                        {filterType === 'competition' && selectedCompetitionIdForFilter && allCompetitions.find(c=>c.id === selectedCompetitionIdForFilter) ?
                            `Ranking for competition: "${allCompetitions.find(c=>c.id === selectedCompetitionIdForFilter)?.name}"` :
                        filterType === 'date' && selectedDate ?
                            `Ranking for date: ${format(selectedDate, "PPP")}` :
                        "Select a filter."
                        }
                  </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(100vh-350px)]">
                  {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                  ) : individualLeaderboard.length === 0 && (filterType === 'competition' && selectedCompetitionIdForFilter || filterType === 'date' && selectedDate) ? (
                      <p className="text-muted-foreground text-center py-4">No individual agent data available for this filter.</p>
                  ) : individualLeaderboard.length > 0 ? (
                    <Leaderboard entries={individualLeaderboard} isStickyHeader={true} />
                  ) : (
                     <p className="text-muted-foreground text-center py-4">Select a filter to view agent leaderboard.</p>
                  )}
              </CardContent>
            </Card>
       </div>
    </Form>
  );
}
