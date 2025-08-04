
// src/app/(admin)/admin/daily-scores/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Send, Filter } from 'lucide-react';
import { format, startOfDay, getDay, endOfDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { sendTeamsUpdate, type AgentScoreForTeams, type PodTargetSummaryForTeams } from '@/services/teamsWebhook';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';


// Interface for processed agent scores used internally in this component
interface AgentScore {
  agentId: string;
  agentFirstName: string;
  totalPoints: number;
  emojiString: string;
  isAbsent: boolean; // Added isAbsent flag
}

// Interface for pod target summary used internally in this component
interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  target: number | null;
  progress?: number;
}

interface CompetitionWithRules extends Competition {
    // No podTargets needed here anymore
}

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DAILY_SCORES_POD_KEY = 'dailyScoresPage_selectedPodId';


export default function AdminDailyScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false); // Combined loading for agents, competition, logs, targets
  const [isSendingToTeams, setIsSendingToTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  React.useEffect(() => {
    const savedPodId = localStorage.getItem(DAILY_SCORES_POD_KEY);
    if (savedPodId) {
        setSelectedPodId(savedPodId);
    }
  }, []);

  const handleSelectedPodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(DAILY_SCORES_POD_KEY, podId);
  };

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

  // Effect to fetch agents and active competition
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setRules([]);
      setDailyLogs([]); // Reset logs when pod changes
      setDailyTargets(null); // Reset targets when pod changes
      setActiveCompetitionId(null);
      setIsLoadingData(false); // Not loading if no pod
      return;
    }

    setIsLoadingData(true); // Start loading for agents/competition
    setError(null);
    setAgents([]);
    setRules([]);
    setActiveCompetitionId(null); // Reset active competition

    const fetchAgentsAndCompetition = async () => {
      console.log(`[DailyScoresPage] Fetching agents for Pod: ${selectedPodId}`);
      try {
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
            setRules([]);
            setActiveCompetitionId(null);
         }

        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', selectedPodId),
          where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let foundCompetition: CompetitionWithRules | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
             if (comp.endDate && comp.endDate instanceof Timestamp && endOfDay(comp.endDate.toDate()) >= startOfDay(selectedDate)) {
                foundCompetition = comp;
                break;
            }
        }

        if (foundCompetition) {
          console.log(`[DailyScoresPage] Active competition found: ${foundCompetition.id}`);
          setRules(foundCompetition.rules || []);
          setActiveCompetitionId(foundCompetition.id);
        } else {
          console.log("[DailyScoresPage] No active competition found.");
          setRules([]);
          setActiveCompetitionId(null);
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for this pod and date." });
          setIsLoadingData(false); // No competition, so stop loading data for this scope
        }

      } catch (err) {
        console.error("[DailyScoresPage] Error fetching agents/competition:", err);
        setError("Failed to load initial data.");
        toast({ variant: "destructive", title: "Error", description: "Could not load competition or agent data." });
        setAgents([]);
        setRules([]);
        setActiveCompetitionId(null);
        setIsLoadingData(false); // Error, stop loading
      }
    };

    fetchAgentsAndCompetition();

   }, [selectedPodId, selectedDate, toast]);

   // Effect to fetch daily logs and targets (depends on activeCompetitionId)
   useEffect(() => {
        if (!activeCompetitionId || !selectedPodId) { // Check if activeCompetitionId and selectedPodId are available
             setDailyLogs([]);
             setDailyTargets(null);
             setIsLoadingData(false); // If no active competition or pod, not loading this data
             return () => {};
         }

         console.log(`[DailyScoresPage] Setting up listeners for Competition: ${activeCompetitionId}, Pod: ${selectedPodId}, Date: ${selectedDate.toISOString()}`);
         setIsLoadingData(true); // Start loading logs/targets specifically

         let unsubscribeLogs: Unsubscribe = () => {};
         let unsubscribeTargets: Unsubscribe = () => {};

         const dateForQuery = Timestamp.fromDate(startOfDay(selectedDate));
         const achievementsRef = collection(db, 'dailyAchievements');
         const logsQuery = query(
             achievementsRef,
             where('podId', '==', selectedPodId),
             where('competitionId', '==', activeCompetitionId),
             where('date', '==', dateForQuery)
         );

          unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
              console.log(`[DailyScoresPage] Received ${snapshot.docs.length} achievement logs from listener for selected date.`);
              const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
              setDailyLogs(fetchedLogs);
              setError(null);
          }, (err) => {
              console.error("[DailyScoresPage] Error listening to achievements:", err);
              setError("Failed to load real-time achievement data.");
              setDailyLogs([]);
              setIsLoadingData(false); // Error, stop loading
          });

         const targetsDocId = `${activeCompetitionId}_${selectedPodId}`;
         const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
         unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
              if (docSnap.exists()) {
                  console.log("[DailyScoresPage] Daily targets data received:", docSnap.data());
                  setDailyTargets(docSnap.data() as DailyTargetData);
              } else {
                  console.log("[DailyScoresPage] No daily targets document found for:", targetsDocId);
                  setDailyTargets(null);
              }
             setIsLoadingData(false); // Both listeners have had a chance or one errored
         }, (err) => {
              console.error("[DailyScoresPage] Error listening to daily targets:", err);
              setError("Failed to load daily target data.");
              setDailyTargets(null);
              setIsLoadingData(false); // Error, stop loading
         });

         return () => {
             console.log("[DailyScoresPage] Unsubscribing from daily logs and targets listeners for date:", selectedDate.toISOString());
             unsubscribeLogs();
             unsubscribeTargets();
         };
   }, [activeCompetitionId, selectedPodId, selectedDate, toast]);


   const { agentScores, podTargetSummary, ruleKeyString, podTargetSummaryString } = useMemo(() => {
     console.log(`[DailyScoresPage] Recalculating scores. Logs: ${dailyLogs.length}, Targets: ${dailyTargets ? 'Yes' : 'No'}, Agents: ${agents.length}, Rules: ${rules.length}`);
    const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
    const ruleTotals: Record<string, number> = {};

    rules.forEach(rule => {
        if(rule.id) ruleTotals[rule.id] = 0;
    });

    dailyLogs.forEach(log => {
      if (log.status === 'absent') {
          if (!scores[log.agentId]) {
              scores[log.agentId] = { totalPoints: 0, emojiString: '', isAbsent: true };
          } else {
              scores[log.agentId].isAbsent = true;
          }
          return; // Skip point calculation for absent agents
      }

      if (!scores[log.agentId]) {
        scores[log.agentId] = { totalPoints: 0, emojiString: '', isAbsent: false };
      }
      scores[log.agentId].totalPoints += log.points;

      if (ruleTotals.hasOwnProperty(log.ruleId)) {
         ruleTotals[log.ruleId] += log.value;
      }
    });

    agents.forEach(agent => {
       if (!agent.id) return;
       const agentLogs = dailyLogs.filter(log => log.agentId === agent.id && log.status !== 'absent');
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

       if (scores[agent.id]) {
         scores[agent.id].emojiString = emojis;
       } else if (agents.find(a => a.id === agent.id)) {
          scores[agent.id] = { totalPoints: 0, emojiString: '', isAbsent: false };
       }
    });

    const finalAgentScores: AgentScore[] = agents
      .map(agent => {
         const agentScoreData = scores[agent.id!] || { totalPoints: 0, emojiString: '', isAbsent: false };
          return {
            agentId: agent.id!,
            agentFirstName: agent.name.split(' ')[0] || agent.name,
            totalPoints: agentScoreData.totalPoints,
            emojiString: agentScoreData.emojiString,
            isAbsent: agentScoreData.isAbsent,
          };
      })
      .sort((a, b) => a.agentFirstName.localeCompare(b.agentFirstName));

    const dayOfWeek = daysOfWeek[getDay(selectedDate)];
    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (targetValue === undefined || targetValue === null) {
                 return null;
            }
            const achieved = ruleTotals[rule.id] || 0;
            const progress = targetValue > 0 ? Math.min(100, Math.round((achieved / targetValue) * 100)) : (achieved > 0 ? 100 : 0);
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleEmoji: rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓',
                achieved: achieved,
                target: targetValue,
                progress: progress,
            };
        })
        .filter((item): item is PodTargetSummary => item !== null)
        .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

     const finalRuleKeyString = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`)
        .join('  ');

     const finalPodTargetSummaryString = finalPodTargetSummary
         .map(summary => `${summary.ruleEmoji} ${summary.ruleName}  ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
         .join(' | ');

    return {
        agentScores: finalAgentScores,
        podTargetSummary: finalPodTargetSummary,
        ruleKeyString: finalRuleKeyString,
        podTargetSummaryString: finalPodTargetSummaryString,
    };
  }, [dailyLogs, agents, rules, dailyTargets, selectedDate]);

  const handleSendToTeams = async () => {
    console.log(`[DailyScoresPage] handleSendToTeams clicked for pod ID: ${selectedPodId}`);
    const currentPod = pods.find(p => p.id === selectedPodId);

    if (!currentPod) {
      console.error(`[DailyScoresPage] Selected pod with ID ${selectedPodId} not found in pods list.`);
      toast({ variant: "destructive", title: "Pod Not Found", description: "Selected pod data could not be found." });
      return;
    }

    const webhookUrl = currentPod.teamsWebhookUrl;
    const podName = currentPod.name;
    console.log(`[DailyScoresPage] Webhook URL for pod ${podName}: ${webhookUrl}`);

    if (!webhookUrl) {
      toast({ variant: "destructive", title: "Missing Webhook", description: "No Teams webhook URL configured for this pod." });
      return;
    }
    if (agentScores.length === 0 && podTargetSummary.length === 0) {
      toast({ variant: "default", title: "No Data", description: "Nothing to send to Teams for this day." });
      return;
    }

    const agentScoresForTeams: AgentScoreForTeams[] = agentScores.map(as => ({
        agentFirstName: as.agentFirstName,
        emojiString: as.isAbsent ? "N/A" : as.emojiString,
        totalPoints: as.totalPoints,
        isAbsent: as.isAbsent,
    }));

    const podTargetSummaryForTeams: PodTargetSummaryForTeams[] = podTargetSummary.map(pts => ({
        ruleName: pts.ruleName,
        ruleEmoji: pts.ruleEmoji,
        achieved: pts.achieved,
        target: pts.target,
    }));

    const payload = {
        title: `Daily Scores - ${podName} (${format(selectedDate, 'PPP')})`,
        kpiKey: rules.map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`).join('  '),
        kpiTable: agentScoresForTeams,
        kpiTargets: podTargetSummaryForTeams.map(summary => `${summary.ruleEmoji} ${summary.ruleName}  ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`).join(' | ')
    };
    console.log("[DailyScoresPage] Data being sent to Teams (Payload):", JSON.stringify(payload, null, 2));


    setIsSendingToTeams(true);
    console.log(`[DailyScoresPage] Calling sendTeamsUpdate for pod ID: ${selectedPodId}, podName: ${podName}, date: ${selectedDate}`);
    try {
      await sendTeamsUpdate(
        podName,
        webhookUrl,
        selectedDate,
        rules,
        agentScoresForTeams,
        podTargetSummaryForTeams
      );
      toast({ title: "Sent to Teams", description: "Daily scores summary has been sent." });
      console.log(`[DailyScoresPage] sendTeamsUpdate completed successfully for pod ID: ${selectedPodId}`);
    } catch (err: any) {
      console.error("[DailyScoresPage] Error sending to Teams:", err);
      toast({ variant: "destructive", title: "Send Failed", description: err.message || "Could not send summary to Teams." });
    } finally {
      setIsSendingToTeams(false);
    }
  };


  const isLoadingDisplay = isLoadingPods || isLoadingData;
  const canDisplayTable = !isLoadingDisplay && selectedPodId && rules.length > 0 && agents.length > 0;
  const canSendToTeams = !isLoadingDisplay && !isSendingToTeams && selectedPodId && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl && (agentScores.length > 0 || podTargetSummary.length > 0);

  return (
    <div className="space-y-6">
    <Card className="frosted-glass">
        <CardHeader>
        <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4 items-end">
                <div className="grid gap-2">
                <Label htmlFor="pod-select">Pod</Label>
                <Select
                    onValueChange={handleSelectedPodChange}
                    value={selectedPodId}
                    disabled={isLoadingPods || isLoadingData}
                >
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
                    <PopoverContent className="w-auto p-0 z-50">
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
        </div>
        </CardContent>
    </Card>

        <Card className="frosted-glass">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Daily Scores</CardTitle>
                    <CardDescription>View daily scores and pod target progress for the selected pod and date.</CardDescription>
                </div>
                <Button
                    onClick={handleSendToTeams}
                    disabled={!canSendToTeams}
                    title={!selectedPodId ? "Select a pod first" : !pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl ? "No webhook URL configured" : (agentScores.length === 0 && podTargetSummary.length === 0) ? "No data to send" : "Send summary to Teams"}
                >
                    {isSendingToTeams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {isSendingToTeams ? "Sending..." : "Send to Teams"}
                </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(100vh-350px)]">
            {error && <p className="text-destructive mb-4">{error}</p>}

            {isLoadingDisplay && (
                 <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                            <TableHead className="w-[150px]"><Skeleton className="h-4 w-20" /></TableHead>
                            <TableHead><Skeleton className="h-4 w-3/4" /></TableHead>
                            <TableHead className="w-[100px] text-right"><Skeleton className="h-4 w-16" /></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-6 w-12" /></TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                 </Table>
            )}

            {!isLoadingDisplay && rules.length > 0 && (
                <div className="mb-4 p-3 border rounded-md bg-muted/50">
                <p className="text-sm whitespace-pre-wrap break-words">{ruleKeyString}</p>
                </div>
            )}

            {canDisplayTable && (
                <>
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
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
                                    {score.isAbsent ? (
                                        <span className="text-sm text-muted-foreground">N/A</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {Array.from(score.emojiString).map((emoji, index) => (
                                                <span key={`${score.agentId}-emoji-${index}`} className="text-lg" title={rules.find(r => r.emoji === emoji)?.name}>
                                                    {emoji}
                                                </span>
                                            ))}
                                            {score.emojiString === '' && <span className="text-sm text-muted-foreground">-</span>}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                    {score.isAbsent ? <span className="text-sm font-normal text-muted-foreground">N/A</span> : score.totalPoints}
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {!isLoadingDisplay && podTargetSummary.length > 0 && (
                        <div className="mt-6 p-4 border-t">
                            <p className="text-sm whitespace-pre-wrap break-words">{podTargetSummaryString}</p>
                        </div>
                    )}
                    {!isLoadingDisplay && rules.length > 0 && podTargetSummary.length === 0 && (
                        <div className="mt-6 p-4 border-t">
                                <p className="text-sm text-muted-foreground">No pod targets set for this specific day.</p>
                        </div>
                    )}
                </>
            )}

            {!isLoadingDisplay && !selectedPodId && (
                <p className="text-center text-muted-foreground mt-6">Please select a pod to view scores.</p>
                )}
                {!isLoadingDisplay && selectedPodId && agents.length === 0 && !error && (
                    <p className="text-center text-muted-foreground mt-6">No agents found in the selected pod.</p>
                )}
                {!isLoadingDisplay && selectedPodId && agents.length > 0 && rules.length === 0 && !error && (
                    <p className="text-center text-muted-foreground mt-6">No active competition found for this pod and date.</p>
                )}
                {!isLoadingDisplay && canDisplayTable && agentScores.length === 0 && dailyLogs.length === 0 && (
                    <p className="text-center text-muted-foreground mt-6">No achievements logged for this pod on this date.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}

