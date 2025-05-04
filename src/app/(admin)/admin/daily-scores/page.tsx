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
import { CalendarIcon, Loader2, AlertCircle, Trophy, Target } from 'lucide-react'; // Removed Clipboard
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
  points: number; // Stored points (value * rule.points at time of logging)
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
     return () => {
         console.log("Unsubscribing from pods listener");
         unsubscribe();
     };
  }, [toast]);

  // 2. Fetch Agents, Competition Rules, Logs (Real-time), and Targets when Pod or Date changes
  useEffect(() => {
    // If no pod is selected, clear data and stop.
    if (!selectedPodId) {
      setAgents([]);
      setRules([]);
      setDailyLogs([]);
      setPodTargets({});
      setIsLoadingData(false); // Ensure loading stops
      return;
    }

    setIsLoadingData(true);
    setError(null);

    // Explicitly reset state for related data before starting fetch/listen
    setAgents([]);
    setRules([]);
    setDailyLogs([]);
    setPodTargets({});

    let unsubscribeLogs: Unsubscribe = () => {}; // Initialize unsubscribe function

    const fetchScoreDataAndListen = async () => {
      console.log(`Fetching data for Pod: ${selectedPodId}, Date: ${selectedDate.toISOString()}`);
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
        setAgents(fetchedAgents); // Update agents state here

         if (fetchedAgents.length === 0) {
            toast({ variant: "default", title: "No Agents", description: "No agents found in this pod." });
            setIsLoadingData(false); // Stop loading if no agents
            setRules([]); // Ensure rules are cleared if no agents
            setPodTargets({}); // Ensure targets are cleared
            return; // Exit early
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
          console.log(`Active competition found: ${activeCompetition.id}`);
          setRules(activeCompetition.rules || []); // Update rules state
          setPodTargets(activeCompetition.podTargets || {}); // Update targets state

          // Setup Real-time Listener for Daily Achievements
          const achievementsRef = collection(db, 'dailyAchievements');
          const logsQuery = query(
            achievementsRef,
            where('podId', '==', selectedPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );

          // Assign the unsubscribe function
           unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
             console.log(`Received ${snapshot.docs.length} achievement logs from listener.`);
             const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
             setDailyLogs(fetchedLogs); // Update logs state directly from listener
             // Only set loading false after the listener provides data
             setIsLoadingData(false);
             setError(null); // Clear error on successful update
           }, (err) => {
               console.error("Error listening to achievements:", err);
               setError("Failed to load real-time achievement data.");
               setDailyLogs([]); // Clear logs on error
               setIsLoadingData(false); // Stop loading on error
           });

        } else {
          console.log("No active competition found.");
          setRules([]); // Ensure rules are cleared
          setDailyLogs([]); // Ensure logs are cleared
          setPodTargets({}); // Ensure targets are cleared
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for this pod and date." });
          setIsLoadingData(false); // Stop loading if no competition
        }

      } catch (err) {
        console.error("Error fetching initial score data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load competition, agent, or achievement data." });
        // Ensure state is clear on error
        setAgents([]);
        setRules([]);
        setDailyLogs([]);
        setPodTargets({});
        setIsLoadingData(false); // Stop loading on error
      }
    };

    fetchScoreDataAndListen();

     // Cleanup function: Unsubscribe from the logs listener when component unmounts or dependencies change
     return () => {
         console.log("Unsubscribing from daily logs listener (Effect Cleanup)");
         unsubscribeLogs();
     };

  }, [selectedPodId, selectedDate, toast]); // Re-run ONLY when podId or date changes

   // 3. Process data for the table and summary (Memoization)
   const { agentScores, podTargetSummary, ruleKeyString, podTargetSummaryString } = useMemo(() => {
     console.log(`Recalculating scores. Current dailyLogs count: ${dailyLogs.length}`);
    // Initialize scores map for ALL agents in the pod
    const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
    agents.forEach(agent => {
      if (agent.id) {
        // Crucially, initialize score to 0 *every time* this recalculates
        scores[agent.id] = { totalPoints: 0, emojiString: '' };
      }
    });

    // Initialize rule totals map
    const ruleTotals: Record<string, number> = {}; // ruleId -> total achieved value
    rules.forEach(rule => {
        if(rule.id) ruleTotals[rule.id] = 0;
    });

    // Aggregate points and achievements per agent and rule totals from *current* dailyLogs state
    dailyLogs.forEach(log => {
      // Agent Scores Accumulation
      if (scores[log.agentId]) { // Check if agent exists in scores map
        // Use the stored points from the log directly
        scores[log.agentId].totalPoints += log.points; // Add points from this log
         console.log(`Agent ${log.agentId}, Rule ${log.ruleId}: Adding ${log.points} points. New total: ${scores[log.agentId].totalPoints}`);
      } else {
         // This shouldn't happen if initialization is correct, but log if it does
         console.warn(`Log found for agent ${log.agentId} who is not in the current agent list or scores map.`);
      }

      // Rule Totals for Pod Summary (uses log.value)
      if (ruleTotals.hasOwnProperty(log.ruleId)) {
         ruleTotals[log.ruleId] += log.value;
      }
    });

    // Build emoji strings for each agent based on current dailyLogs
    agents.forEach(agent => {
       if (!agent.id || !scores[agent.id]) return; // Check if agent exists in scores map

       const agentLogs = dailyLogs.filter(log => log.agentId === agent.id);
       let emojis = '';
       const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));

       sortedRules.forEach(rule => {
           if (!rule.id) return;
            const logForRule = agentLogs.find(log => log.ruleId === rule.id);
            if (logForRule && logForRule.value > 0) {
                const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                for (let i = 0; i < logForRule.value; i++) {
                    emojis += emojiToUse;
                }
            }
       });
       // Assign the calculated emoji string
       scores[agent.id].emojiString = emojis;
    });

    // Map to final AgentScore array, adding names and sorting by points
    const finalAgentScores: AgentScore[] = agents
      .map(agent => {
         const agentScoreData = scores[agent.id!] || { totalPoints: 0, emojiString: '' }; // Default if missing
          return {
            agentId: agent.id!,
            agentFirstName: agent.name.split(' ')[0] || agent.name,
            totalPoints: agentScoreData.totalPoints,
            emojiString: agentScoreData.emojiString,
          };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints); // Sort descending by points

    // Build Pod Target Summary array
    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
             const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleEmoji: emojiToUse,
                achieved: ruleTotals[rule.id] || 0,
                target: podTargets[rule.id] ?? null,
            };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

     // Generate Rule Key String
     const finalRuleKeyString = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = ${rule.name} (${rule.points} pts)`)
        .join(' ');

     // Generate Pod Target Summary String
     const finalPodTargetSummaryString = finalPodTargetSummary
         .map(summary => `${summary.ruleEmoji} ${summary.ruleName}  ${summary.achieved}${summary.target !== null ? `/${summary.target}` : ''}`) // Added extra space
         .join(' | ');

    return {
        agentScores: finalAgentScores,
        podTargetSummary: finalPodTargetSummary,
        ruleKeyString: finalRuleKeyString,
        podTargetSummaryString: finalPodTargetSummaryString,
    };
    // Dependencies ensure recalculation when logs, agents, rules, or targets change
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
               <Skeleton className="h-6 w-full mb-4" /> {/* Key skeleton */}
               <Skeleton className="h-10 w-full" /> {/* Header skeleton */}
               {Array.from({ length: 3 }).map((_, i) => (
                 <Skeleton key={i} className="h-12 w-full" />
               ))}
                <Skeleton className="h-8 w-full mt-4" /> {/* Footer skeleton */}
             </div>
           )}


           {/* Rule Key Display - Formatted as requested */}
          {!isLoading && rules.length > 0 && (
            <div className="mb-4 p-3 border rounded-md bg-muted/50">
              <p className="text-xs whitespace-pre-wrap break-words">{ruleKeyString}</p>
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
                                {/* Use Array.from for proper emoji rendering */}
                                <div className="flex flex-wrap gap-1">
                                    {Array.from(score.emojiString).map((emoji, index) => (
                                        <span key={`${score.agentId}-emoji-${index}`} className="text-lg" title={rules.find(r => r.emoji === emoji)?.name}>
                                            {emoji}
                                        </span>
                                    ))}
                                    {/* Show '-' only if the string is genuinely empty */}
                                    {score.emojiString === '' && <span className="text-sm text-muted-foreground">-</span>}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                                {score.totalPoints}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Pod Target Summary Footer - Formatted as requested */}
                 {!isLoading && podTargetSummary.length > 0 && (
                     <div className="mt-6 p-4 border-t">
                          <p className="text-sm whitespace-pre-wrap break-words">{podTargetSummaryString}</p>
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
             {!isLoading && canDisplay && agentScores.every(score => score.totalPoints === 0) && dailyLogs.length === 0 && ( // Check if all scores are zero AND no logs exist
                 <p className="text-center text-muted-foreground mt-6">No achievements logged for this pod on this date.</p>
            )}


        </CardContent>
      </Card>
    </div>
  );
}
