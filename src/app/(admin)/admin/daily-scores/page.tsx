'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  orderBy,
  onSnapshot, // Import onSnapshot
  Unsubscribe, // Import Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Trophy, Target } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Interface for the data stored in Firestore for achievements
interface DailyAchievementLog {
  id?: string; // Firestore ID
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName: string; // Store name for display convenience
  date: Timestamp;
  value: number;
  points: number;
  loggedAt: Timestamp;
  loggedBy?: string | null;
}

// Interface for processed agent scores
interface AgentScore {
  agentId: string;
  agentFirstName: string; // Store first name
  totalPoints: number;
  emojiString: string; // String of repeated emojis
}

// Interface for pod target summary
interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  target: number | null; // Target might not be set
}

// Extend Competition interface to include podTargets (assuming structure)
// Note: You'll need to update this in competitions/page.tsx as well if needed elsewhere
interface CompetitionWithTargets extends Competition {
    podTargets?: Record<string, number>; // ruleId -> targetValue
}


export default function AdminDailyScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date())); // Default to today
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
  const [podTargets, setPodTargets] = useState<Record<string, number>>({}); // ruleId -> target
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false); // Loading competition, agents, logs
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Fetch Pods
  useEffect(() => {
    setIsLoadingPods(true);
    const podsRef = collection(db, 'pods');
    const q = query(podsRef, orderBy('name'));
    // Use onSnapshot for pods to react to changes, though less critical than logs
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
      setPods(fetchedPods);
      setError(null);
      setIsLoadingPods(false); // Set loading false after first fetch
    }, (err) => {
        console.error("Error fetching pods:", err);
        setError("Failed to load pods.");
        toast({ variant: "destructive", title: "Error", description: "Could not load pods." });
        setIsLoadingPods(false);
    });
     return () => unsubscribe(); // Cleanup listener
  }, [toast]);

  // 2. Fetch Agents, Competition Rules, Logs (Real-time), and Targets when Pod or Date changes
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setRules([]);
      setDailyLogs([]);
      setPodTargets({});
      return;
    }

    setIsLoadingData(true);
    setError(null);
    // Reset previous state for related data
    setAgents([]);
    setRules([]);
    setDailyLogs([]); // Logs will be updated by listener
    setPodTargets({});

    let unsubscribeLogs: Unsubscribe = () => {}; // Initialize unsubscribe function

    const fetchScoreData = async () => {


      try {
        // Fetch Agents for the selected Pod (can remain getDocs as agents change less often)
        const usersRef = collection(db, 'users');
        const agentsQuery = query(
            usersRef,
            where('podId', '==', selectedPodId),
            where('roles', 'array-contains', 'agent'),
            orderBy('name')
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAgents(fetchedAgents);

         if (fetchedAgents.length === 0) {
            toast({ variant: "default", title: "No Agents", description: "No agents found in this pod." });
            setIsLoadingData(false); // Stop loading if no agents
             return;
         }

        // Find the active Competition for the Pod and Date (can remain getDocs)
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const competitionQuery = query(
          competitionsRef,
          where('podId', '==', selectedPodId),
          where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let activeCompetition: CompetitionWithTargets | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithTargets & { id: string };
            if (comp.endDate && comp.endDate.toDate() >= dateTimestamp) {
                activeCompetition = comp;
                break;
            }
        }

        if (activeCompetition) {
          setRules(activeCompetition.rules || []);
          setPodTargets(activeCompetition.podTargets || {}); // Set pod targets from competition doc

          // Setup Real-time Listener for Daily Achievements
          const achievementsRef = collection(db, 'dailyAchievements');
          const logsQuery = query(
            achievementsRef,
            where('podId', '==', selectedPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
            // No ordering needed here, process later
          );

          // Assign the unsubscribe function
           unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
             const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
             setDailyLogs(fetchedLogs);
             setIsLoadingData(false); // Data loaded/updated
             setError(null); // Clear error on successful update
           }, (err) => {
               console.error("Error listening to achievements:", err);
               setError("Failed to load real-time achievement data.");
               setDailyLogs([]); // Clear logs on error
               setIsLoadingData(false); // Stop loading on error
           });

        } else {
          setRules([]);
          setDailyLogs([]); // Clear logs if no active competition
          setPodTargets({});
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for this pod and date." });
          setIsLoadingData(false); // Stop loading if no competition
        }

      } catch (err) {
        console.error("Error fetching initial score data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load competition, agent, or achievement data." });
        setAgents([]);
        setRules([]);
        setDailyLogs([]);
        setPodTargets({});
        setIsLoadingData(false); // Stop loading on error
      }
      // Don't set isLoadingData to false here, listener will handle it
    };

    fetchScoreData();

     // Cleanup function for the listener
     return () => {
         console.log("Unsubscribing from daily logs listener");
         unsubscribeLogs();
     };

  }, [selectedPodId, selectedDate, toast]); // Re-run when podId or date changes

  // 3. Process data for the table and summary (Memoization remains the same)
  const { agentScores, podTargetSummary } = useMemo(() => {
    const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
    const ruleTotals: Record<string, number> = {}; // ruleId -> total achieved value

    // Initialize rule totals
    rules.forEach(rule => {
        if(rule.id) ruleTotals[rule.id] = 0;
    });

    // Aggregate points and achievements per agent and rule totals
    dailyLogs.forEach(log => {
      // Agent Scores
      if (!scores[log.agentId]) {
        scores[log.agentId] = { totalPoints: 0, emojiString: '' };
      }
      scores[log.agentId].totalPoints += log.points;

      // Rule Totals for Pod Summary
      if (ruleTotals.hasOwnProperty(log.ruleId)) {
         ruleTotals[log.ruleId] += log.value;
      }
    });

    // Build emoji strings for each agent
    agents.forEach(agent => {
       if (!agent.id) return;
      const agentLogs = dailyLogs.filter(log => log.agentId === agent.id);
      let emojis = '';
       // Sort rules for consistent emoji order? Optional.
       const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));

       sortedRules.forEach(rule => {
           if (!rule.id) return;
            const logForRule = agentLogs.find(log => log.ruleId === rule.id);
            if (logForRule && logForRule.value > 0) {
                emojis += (rule.emoji || '❓').repeat(logForRule.value); // Use emoji or fallback
            }
       });

       if (scores[agent.id]) {
         scores[agent.id].emojiString = emojis;
       } else if (agents.find(a => a.id === agent.id)) {
          // Ensure agent exists in scores map even if they have 0 points/logs for the day
          scores[agent.id] = { totalPoints: 0, emojiString: '' };
       }
    });


    // Map to final AgentScore array, adding names and sorting by points
    const finalAgentScores: AgentScore[] = agents
      .map(agent => ({
        agentId: agent.id!,
        // Extract first name (simple split)
        agentFirstName: agent.name.split(' ')[0] || agent.name,
        totalPoints: scores[agent.id!]?.totalPoints || 0,
        emojiString: scores[agent.id!]?.emojiString || '',
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints); // Sort descending by points

    // Build Pod Target Summary
    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null; // Skip rules without ID
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleEmoji: rule.emoji || '❓',
                achieved: ruleTotals[rule.id] || 0,
                target: podTargets[rule.id] ?? null, // Get target from state, null if not set
            };
        })
        .filter((item): item is PodTargetSummary => item !== null) // Remove nulls
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName)); // Sort by name

    return { agentScores: finalAgentScores, podTargetSummary: finalPodTargetSummary };
  }, [dailyLogs, agents, rules, podTargets]);


  const isLoading = isLoadingPods || isLoadingData;
  const canDisplay = !isLoading && selectedPodId && rules.length > 0 && agents.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Scores</CardTitle>
          <CardDescription>View daily scores and pod target progress for the selected pod and date.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Pod Select */}
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select onValueChange={setSelectedPodId} value={selectedPodId} disabled={isLoadingPods || isLoadingData}>
                <SelectTrigger id="pod-select" className="w-[200px]">
                  <SelectValue placeholder={isLoadingPods ? "Loading..." : "Select Pod"} />
                </SelectTrigger>
                <SelectContent>
                  {pods.map(pod => (
                    <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                  ))}
                  {pods.length === 0 && !isLoadingPods && <SelectItem value="-" disabled>No pods found</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Date Select */}
            <div className="grid gap-2">
              <Label htmlFor="date-select">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-select"
                    variant={"outline"}
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                     disabled={isLoadingData} // Disable only data loading, not initial pod loading
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
          </div>

          {error && <p className="text-destructive mb-4">{error}</p>}

           {/* Loading State */}
           {isLoading && (
             <div className="space-y-4">
               <Skeleton className="h-6 w-3/4" /> {/* Key skeleton */}
               <Skeleton className="h-10 w-full" /> {/* Header skeleton */}
               {Array.from({ length: 3 }).map((_, i) => (
                 <Skeleton key={i} className="h-12 w-full" />
               ))}
                <Skeleton className="h-8 w-full mt-4" /> {/* Footer skeleton */}
             </div>
           )}


          {/* Rule Key */}
          {!isLoading && rules.length > 0 && (
            <div className="mb-4 p-3 border rounded-md bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Rule Key:</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {rules.map(rule => (
                  <span key={rule.id} className="whitespace-nowrap">
                    {rule.emoji || '❓'} = {rule.name} ({rule.points} pts)
                  </span>
                ))}
              </div>
            </div>
          )}


          {/* Scores Table */}
          {canDisplay && (
            <>
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[150px]">Agent</TableHead>
                        <TableHead>Achievements</TableHead>
                        <TableHead className="w-[100px] text-right">Total Score</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agentScores.map((score) => (
                        <TableRow key={score.agentId}>
                            <TableCell className="font-medium">{score.agentFirstName}</TableCell>
                            {/* Render emojis with wrapping */}
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {score.emojiString.split('').map((emoji, index) => (
                                        <span key={index} className="text-lg" title={rules.find(r => r.emoji === emoji)?.name}> {/* Basic tooltip */}
                                            {emoji}
                                        </span>
                                    ))}
                                     {score.emojiString.length === 0 && <span className="text-sm text-muted-foreground">-</span>}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                                {score.totalPoints}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Pod Target Summary Footer */}
                 {podTargetSummary.length > 0 && (
                     <div className="mt-6 p-4 border-t">
                        <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                            <Target className="h-5 w-5 text-muted-foreground"/> Pod Target Summary
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                        {podTargetSummary.map(summary => (
                            <div key={summary.ruleId} className="flex items-center justify-between">
                                <span className="font-medium truncate" title={summary.ruleName}>
                                    {summary.ruleEmoji} {summary.ruleName}
                                </span>
                                <span className={cn("font-semibold", summary.target !== null && summary.achieved >= summary.target ? "text-green-600" : "text-muted-foreground")}>
                                    {summary.achieved}
                                    {summary.target !== null ? ` / ${summary.target}` : ''}
                                </span>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
             </>
          )}

          {/* No Data States */}
           {!isLoading && !selectedPodId && (
               <p className="text-center text-muted-foreground mt-6">Please select a pod to view scores.</p>
            )}
            {!isLoading && selectedPodId && agents.length === 0 && !error && (
                <p className="text-center text-muted-foreground mt-6">No agents found in the selected pod.</p>
            )}
            {!isLoading && selectedPodId && agents.length > 0 && rules.length === 0 && !error && (
                 <p className="text-center text-muted-foreground mt-6">No active competition found for this pod and date.</p>
            )}
             {!isLoading && canDisplay && dailyLogs.length === 0 && (
                 <p className="text-center text-muted-foreground mt-6">No achievements logged for this pod on this date.</p>
            )}


        </CardContent>
      </Card>
    </div>
  );
}
