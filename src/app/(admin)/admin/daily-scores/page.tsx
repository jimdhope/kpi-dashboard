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
import { CalendarIcon, Loader2, AlertCircle, Trophy, Target } from 'lucide-react'; // Added Target
import { format, startOfDay, getDay } from 'date-fns'; // Added getDay
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page'; // Import new target type

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

// Competition interface (no podTargets needed)
interface CompetitionWithRules extends Competition {
    // No podTargets needed here anymore
}

// Days of the week map
const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];


export default function AdminDailyScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date())); // Default to today
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null); // State for daily targets
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false); // Loading competition, agents, logs, targets
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Fetch Pods (remains the same)
  useEffect(() => {
    setIsLoadingPods(true);
    const podsRef = collection(db, 'pods');
    const q = query(podsRef, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
      setPods(fetchedPods);
      setError(null);
      setIsLoadingPods(false);
    }, (err) => {
        console.error("Error fetching pods:", err);
        setError("Failed to load pods.");
        toast({ variant: "destructive", title: "Error", description: "Could not load pods." });
        setIsLoadingPods(false);
    });
     return () => unsubscribe();
  }, [toast]);

  // 2. Fetch Agents, Competition Rules, Logs (Real-time), and Daily Targets when Pod or Date changes
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setRules([]);
      setDailyLogs([]);
      setDailyTargets(null); // Clear targets
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setError(null);

    setAgents([]);
    setRules([]);
    setDailyLogs([]);
    setDailyTargets(null); // Reset targets

    let unsubscribeLogs: Unsubscribe = () => {}; // Initialize unsubscribe function
    let unsubscribeTargets: Unsubscribe = () => {}; // Initialize unsubscribe function for targets

    const fetchScoreDataAndListen = async () => {
      console.log(`Fetching data for Pod: ${selectedPodId}, Date: ${selectedDate.toISOString()}`);
      try {
        // Fetch Agents (remains the same)
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
            setIsLoadingData(false);
            setRules([]);
            setDailyTargets(null); // Ensure targets cleared
            return;
         }

        // Find the active Competition (use array-contains for podIds)
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', selectedPodId), // Check if podId is in the podIds array
          where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let activeCompetition: CompetitionWithRules | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules & { id: string };
            if (comp.endDate && comp.endDate.toDate() >= dateTimestamp) {
                activeCompetition = comp;
                break;
            }
        }

        if (activeCompetition) {
          console.log(`Active competition found: ${activeCompetition.id}`);
          setRules(activeCompetition.rules || []); // Update rules state

          // Listen to Daily Achievements (remains the same)
          const achievementsRef = collection(db, 'dailyAchievements');
          const logsQuery = query(
            achievementsRef,
            where('podId', '==', selectedPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );
           unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
             console.log(`Received ${snapshot.docs.length} achievement logs from listener.`);
             const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
             setDailyLogs(fetchedLogs);
             // Don't set loading false until targets are also fetched/updated
             // setIsLoadingData(false);
           }, (err) => {
               console.error("Error listening to achievements:", err);
               setError("Failed to load real-time achievement data.");
               setDailyLogs([]);
               setIsLoadingData(false);
           });

           // Listen to Daily Targets document
           const targetsDocId = `${activeCompetition.id}_${selectedPodId}`;
           const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
           unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    console.log("Daily targets data received:", docSnap.data());
                    setDailyTargets(docSnap.data() as DailyTargetData);
                } else {
                    console.log("No daily targets document found for:", targetsDocId);
                    setDailyTargets(null); // No targets set for this combo
                }
                // Set loading false after both logs and targets listeners have provided initial data
                setIsLoadingData(false);
                setError(null);
           }, (err) => {
                console.error("Error listening to daily targets:", err);
                setError("Failed to load daily target data.");
                setDailyTargets(null);
                setIsLoadingData(false);
           });


        } else {
          console.log("No active competition found.");
          setRules([]); // Ensure rules are cleared
          setDailyLogs([]); // Ensure logs are cleared
          setDailyTargets(null); // Ensure targets are cleared
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for this pod and date." });
          setIsLoadingData(false);
        }

      } catch (err) {
        console.error("Error fetching initial score data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load competition, agent, or achievement data." });
        setAgents([]);
        setRules([]);
        setDailyLogs([]);
        setDailyTargets(null);
        setIsLoadingData(false);
      }
    };

    fetchScoreDataAndListen();

     // Cleanup function: Unsubscribe from listeners
     return () => {
         console.log("Unsubscribing from daily logs and targets listeners");
         unsubscribeLogs();
         unsubscribeTargets();
     };

  }, [selectedPodId, selectedDate, toast]); // Re-run ONLY when podId or date changes

   // 3. Process data for the table and summary (Memoization adjusted for new targets)
   const { agentScores, podTargetSummary, ruleKeyString, podTargetSummaryString } = useMemo(() => {
     console.log(`Recalculating scores. Logs: ${dailyLogs.length}, Targets: ${dailyTargets ? 'Yes' : 'No'}`);
     // Calculate agent scores (remains largely the same)
    const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
    agents.forEach(agent => {
      if (agent.id) {
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
      if (scores[log.agentId]) {
        scores[log.agentId].totalPoints += log.points;
      } else {
         console.warn(`Log found for agent ${log.agentId} who is not in the current agent list or scores map.`);
      }

      // Rule Totals for Pod Summary (uses log.value)
      if (ruleTotals.hasOwnProperty(log.ruleId)) {
         ruleTotals[log.ruleId] += log.value;
      }
    });

    // Build emoji strings for each agent based on current dailyLogs
    agents.forEach(agent => {
       if (!agent.id || !scores[agent.id]) return;

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
       scores[agent.id].emojiString = emojis;
    });

    // Map to final AgentScore array, adding names and sorting by points
    const finalAgentScores: AgentScore[] = agents
      .map(agent => {
         const agentScoreData = scores[agent.id!] || { totalPoints: 0, emojiString: '' };
          return {
            agentId: agent.id!,
            agentFirstName: agent.name.split(' ')[0] || agent.name,
            totalPoints: agentScoreData.totalPoints,
            emojiString: agentScoreData.emojiString,
          };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // Build Pod Target Summary array - FILTERED based on dailyTargets for the selected day
    const dayOfWeek = daysOfWeek[getDay(selectedDate)]; // Get 'mon', 'tue', etc.
    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            // Only include if a target is explicitly set (not undefined or null) for this day
            if (targetValue === undefined || targetValue === null) {
                 return null;
            }

            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleEmoji: emojiToUse,
                achieved: ruleTotals[rule.id] || 0,
                target: targetValue, // Use the target for the specific day
            };
        })
        .filter((item): item is PodTargetSummary => item !== null) // Remove null entries
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));


     // Generate Rule Key String (remains the same)
     const finalRuleKeyString = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = ${rule.name} (${rule.points} pts)`)
        .join(' ');

     // Generate Pod Target Summary String - using the FILTERED summary for the day
     const finalPodTargetSummaryString = finalPodTargetSummary
         .map(summary => `${summary.ruleEmoji} ${summary.ruleName}  ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
         .join(' | ');

    return {
        agentScores: finalAgentScores,
        podTargetSummary: finalPodTargetSummary, // Use the filtered summary
        ruleKeyString: finalRuleKeyString,
        podTargetSummaryString: finalPodTargetSummaryString, // Use the filtered summary string
    };
    // Dependencies ensure recalculation when logs, agents, rules, or targets change
  }, [dailyLogs, agents, rules, dailyTargets, selectedDate]);



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
                     disabled={isLoadingData}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50"> {/* Added z-50 */}
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


           {/* Rule Key Display */}
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
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {Array.from(score.emojiString).map((emoji, index) => (
                                        <span key={`${score.agentId}-emoji-${index}`} className="text-lg" title={rules.find(r => r.emoji === emoji)?.name}>
                                            {emoji}
                                        </span>
                                    ))}
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

                {/* Pod Target Summary Footer - Render only if there are targets for the selected day */}
                 {!isLoading && podTargetSummary.length > 0 && (
                     <div className="mt-6 p-4 border-t">
                          <p className="text-sm whitespace-pre-wrap break-words">{podTargetSummaryString}</p>
                    </div>
                )}
                 {/* Show message if no targets are set for the selected day */}
                  {!isLoading && rules.length > 0 && podTargetSummary.length === 0 && (
                       <div className="mt-6 p-4 border-t">
                            <p className="text-sm text-muted-foreground">No pod targets set for this specific day.</p>
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
             {!isLoading && canDisplay && agentScores.every(score => score.totalPoints === 0) && dailyLogs.length === 0 && (
                 <p className="text-center text-muted-foreground mt-6">No achievements logged for this pod on this date.</p>
            )}


        </CardContent>
      </Card>
    </div>
  );
}
