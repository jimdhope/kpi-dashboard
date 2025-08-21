
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
import { CalendarIcon, Loader2, AlertCircle, Send, Filter, Swords, Trophy } from 'lucide-react'; // Added Swords & Trophy
import { format, startOfDay, getDay, endOfDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/models/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { sendTeamsUpdate, type AgentScoreForTeams, type PodTargetSummaryForTeams, type SimpleTaskLog, type TeamTotalScore } from '@/services/teamsWebhook'; // Import TeamTotalScore
import type { DailyAchievementLog, DailyTaskLog, TeamBonusLog } from '@/app/(admin)/admin/log-achievements/page';


// Interface for processed agent scores used internally in this component
interface AgentScore {
  agentId: string;
  agentFirstName: string;
  totalPoints: number;
  emojiString: string;
  isAbsent: boolean; // Added isAbsent flag
  teamEmoji?: string; // Added teamEmoji
  completedTasks?: { ruleName: string; ruleEmoji: string }[];
  targetProgress?: string; // New string for target progress display
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

interface Team {
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string; // Add emoji to team interface
}

interface CompetitionWithRules extends Competition {
    teams?: Team[];
}

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DAILY_SCORES_POD_KEY = 'dailyScoresPage_selectedPodId';


export default function AdminDailyScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]); // All logs for the competition
  const [competitionBonusLogs, setCompetitionBonusLogs] = useState<TeamBonusLog[]>([]); // All bonus logs for the competition
  const [dailyTaskLogs, setDailyTaskLogs] = useState<DailyTaskLog[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [teams, setTeams] = useState<Team[]>([]); // State for teams
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
      setCompetitionLogs([]); // Reset logs when pod changes
      setCompetitionBonusLogs([]);
      setDailyTaskLogs([]);
      setTeams([]);
      setDailyTargets(null); // Reset targets when pod changes
      setActiveCompetitionId(null);
      setIsLoadingData(false); // Not loading if no pod
      return;
    }

    setIsLoadingData(true); // Start loading for agents/competition
    setError(null);
    setAgents([]);
    setRules([]);
    setTeams([]);
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
            setTeams([]);
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
          setTeams(foundCompetition.teams || []); // Set teams from competition
          setActiveCompetitionId(foundCompetition.id);
        } else {
          console.log("[DailyScoresPage] No active competition found.");
          setRules([]);
          setTeams([]);
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
        setTeams([]);
        setActiveCompetitionId(null);
        setIsLoadingData(false); // Error, stop loading
      }
    };

    fetchAgentsAndCompetition();

   }, [selectedPodId, selectedDate, toast]);

   // Effect to fetch daily logs and targets (depends on activeCompetitionId)
   useEffect(() => {
        if (!activeCompetitionId || !selectedPodId) { // Check if activeCompetitionId and selectedPodId are available
             setCompetitionLogs([]);
             setCompetitionBonusLogs([]);
             setDailyTaskLogs([]);
             setDailyTargets(null);
             setIsLoadingData(false); // If no active competition or pod, not loading this data
             return () => {};
         }

         console.log(`[DailyScoresPage] Setting up listeners for Competition: ${activeCompetitionId}, Pod: ${selectedPodId}, Date: ${selectedDate.toISOString()}`);
         setIsLoadingData(true); // Start loading logs/targets specifically

         let unsubscribeCompLogs: Unsubscribe = () => {};
         let unsubscribeCompBonusLogs: Unsubscribe = () => {};
         let unsubscribeTaskLogs: Unsubscribe = () => {};
         let unsubscribeTargets: Unsubscribe = () => {};

         const achievementsRef = collection(db, 'dailyAchievements');
         const compLogsQuery = query(
             achievementsRef,
             where('podId', '==', selectedPodId),
             where('competitionId', '==', activeCompetitionId)
         );
          unsubscribeCompLogs = onSnapshot(compLogsQuery, (snapshot) => {
              const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
              setCompetitionLogs(fetchedLogs);
              setError(null);
          }, (err) => {
              console.error("[DailyScoresPage] Error listening to competition achievements:", err);
              setError("Failed to load real-time achievement data.");
              setCompetitionLogs([]);
          });

          const bonusLogsRef = collection(db, 'teamBonusLogs');
          const compBonusLogsQuery = query(
            bonusLogsRef,
            where('podId', '==', selectedPodId),
            where('competitionId', '==', activeCompetitionId)
          );
           unsubscribeCompBonusLogs = onSnapshot(compBonusLogsQuery, (snapshot) => {
              const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBonusLog));
              setCompetitionBonusLogs(fetchedLogs);
           }, (err) => {
              console.error("[DailyScoresPage] Error listening to competition bonus logs:", err);
              setError("Failed to load real-time bonus data.");
              setCompetitionBonusLogs([]);
           });


          const taskLogsRef = collection(db, 'dailyTaskLogs');
          const dateForQuery = Timestamp.fromDate(startOfDay(selectedDate));
          const taskLogsQuery = query(
            taskLogsRef,
            where('podId', '==', selectedPodId),
            where('competitionId', '==', activeCompetitionId),
            where('date', '==', dateForQuery)
          );

           unsubscribeTaskLogs = onSnapshot(taskLogsQuery, (snapshot) => {
              const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyTaskLog));
              setDailyTaskLogs(fetchedLogs);
           }, (err) => {
              console.error("[DailyScoresPage] Error listening to task logs:", err);
              setError("Failed to load real-time task data.");
              setDailyTaskLogs([]);
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
             setIsLoadingData(false); // All listeners have had a chance or errored
         }, (err) => {
              console.error("[DailyScoresPage] Error listening to daily targets:", err);
              setError("Failed to load daily target data.");
              setDailyTargets(null);
              setIsLoadingData(false); // Error, stop loading
         });

         return () => {
             console.log("[DailyScoresPage] Unsubscribing from daily logs and targets listeners for date:", selectedDate.toISOString());
             unsubscribeCompLogs();
             unsubscribeCompBonusLogs();
             unsubscribeTaskLogs();
             unsubscribeTargets();
         };
   }, [activeCompetitionId, selectedPodId, selectedDate, toast]);


   const { agentScores, teamBonusSummary, teamTotalScores, ruleKeyString } = useMemo(() => {
    const todayStart = startOfDay(selectedDate);
    const dailyLogs = competitionLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
    const dailyBonusLogs = competitionBonusLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());

    const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
    const rulesMap = new Map(rules.map(rule => [rule.id, rule]));
    const dayOfWeek = daysOfWeek[getDay(selectedDate)];

    dailyLogs.forEach(log => {
      if (log.status === 'absent') {
        if (!scores[log.agentId]) {
          scores[log.agentId] = { totalPoints: 0, emojiString: '', isAbsent: true, completedTasks: [], targetProgress: '' };
        } else {
          scores[log.agentId].isAbsent = true;
        }
        return;
      }
      const rule = rulesMap.get(log.ruleId);
      if (rule) {
        const points = (log.value || 0) * (rule.points || 0);
        if (!scores[log.agentId]) scores[log.agentId] = { totalPoints: 0, emojiString: '', isAbsent: false, completedTasks: [], targetProgress: '' };
        scores[log.agentId].totalPoints += points;
      }
    });

    agents.forEach(agent => {
      if (!agent.id) return;
      const agentLogs = dailyLogs.filter(log => log.agentId === agent.id && log.status !== 'absent');
      let emojis = '';
      const sortedNumericRules = rules.filter(r => r.type === 'numeric').sort((a, b) => a.name.localeCompare(b.name));
      sortedNumericRules.forEach(rule => {
        if (!rule.id) return;
        const logForRule = agentLogs.find(log => log.ruleId === rule.id);
        if (logForRule && logForRule.value > 0) {
          const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
          for (let i = 0; i < logForRule.value; i++) {
            emojis += emojiToUse;
          }
        }
      });
      const targetProgressParts = sortedNumericRules.map(rule => {
          if (!rule.id) return null;
          const target = dailyTargets?.[rule.id]?.[dayOfWeek];
          if (target === undefined || target === null || target < 0) return null;
          const achieved = agentLogs.find(log => log.ruleId === rule.id)?.value || 0;
          return `${rule.emoji || '❓'} ${achieved}/${target}`;
      }).filter(Boolean);
      const agentTaskLogs = dailyTaskLogs.filter(log => log.agentId === agent.id);
      const completedTasks = agentTaskLogs.map(taskLog => {
        const rule = rules.find(r => r.id === taskLog.taskId && r.type === 'checkbox');
        return { ruleName: rule?.name || 'Unknown Task', ruleEmoji: (rule?.emoji && rule.emoji.trim() !== '') ? rule.emoji : '✅' };
      });
      const agentTeam = teams.find(team => team.agentIds?.includes(agent.id!));
      if (scores[agent.id]) {
        scores[agent.id].emojiString = emojis;
        scores[agent.id].completedTasks = completedTasks;
        scores[agent.id].teamEmoji = agentTeam?.emoji;
        scores[agent.id].targetProgress = targetProgressParts.join(' | ');
      } else if (agents.find(a => a.id === agent.id)) {
        scores[agent.id] = { totalPoints: 0, emojiString: '', isAbsent: false, completedTasks: completedTasks, teamEmoji: agentTeam?.emoji, targetProgress: targetProgressParts.join(' | ') };
      }
    });

    const finalAgentScores: AgentScore[] = agents
      .map(agent => {
        const agentScoreData = scores[agent.id!] || { totalPoints: 0, emojiString: '', isAbsent: false, completedTasks: [], teamEmoji: undefined, targetProgress: '' };
        return {
          agentId: agent.id!,
          agentFirstName: agent.name.split(' ')[0] || agent.name,
          totalPoints: agentScoreData.totalPoints,
          emojiString: agentScoreData.emojiString,
          isAbsent: agentScoreData.isAbsent,
          completedTasks: agentScoreData.completedTasks,
          teamEmoji: agentScoreData.teamEmoji,
          targetProgress: agentScoreData.targetProgress,
        };
      })
      .sort((a, b) => a.agentFirstName.localeCompare(b.agentFirstName));

     const teamBonusSummary = teams.map(team => {
        const bonus = dailyBonusLogs.filter(log => log.teamId === team.id).reduce((acc, log) => acc + log.points, 0);
        return { teamName: team.name, teamEmoji: team.emoji, bonusPoints: bonus };
     }).filter(summary => summary.bonusPoints > 0);

     const teamTotalScoresMap: { [teamId: string]: number } = {};
     teams.forEach(team => teamTotalScoresMap[team.id] = 0);
     competitionLogs.forEach(log => {
        const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
        if (agentTeam) {
            teamTotalScoresMap[agentTeam.id] += log.points || 0;
        }
     });
     competitionBonusLogs.forEach(log => {
        if(teamTotalScoresMap.hasOwnProperty(log.teamId)) {
            teamTotalScoresMap[log.teamId] += log.points || 0;
        }
     });
     const finalTeamTotalScores = teams.map(team => ({
        teamName: team.name,
        teamEmoji: team.emoji,
        totalPoints: teamTotalScoresMap[team.id] || 0
     })).sort((a,b) => b.totalPoints - a.totalPoints);

     const numericRules = rules.filter(r => r.type === 'numeric');
     const taskRules = rules.filter(r => r.type === 'checkbox');
     let finalRuleKeyString = numericRules.map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`).join('  ');
     const taskKeyString = taskRules.map(rule => `${rule.emoji || '✅'}=${rule.name}`).join('  ');
     if (taskKeyString) {
         finalRuleKeyString += (finalRuleKeyString ? ' | ' : '') + taskKeyString;
     }

    return {
        agentScores: finalAgentScores,
        teamBonusSummary: teamBonusSummary,
        teamTotalScores: finalTeamTotalScores,
        ruleKeyString: finalRuleKeyString,
    };
  }, [competitionLogs, competitionBonusLogs, dailyTaskLogs, agents, rules, dailyTargets, selectedDate, teams]);

  const handleSendToTeams = async () => {
    const currentPod = pods.find(p => p.id === selectedPodId);
    if (!currentPod || !currentPod.teamsWebhookUrl) {
      toast({ variant: "destructive", title: "Missing Webhook", description: "No Teams webhook URL configured for this pod." });
      return;
    }
    const webhookUrl = currentPod.teamsWebhookUrl;
    const podName = currentPod.name;
    if (agentScores.length === 0 && teamBonusSummary.length === 0) {
      toast({ variant: "default", title: "No Data", description: "Nothing to send to Teams for this day." });
      return;
    }

    const agentScoresForTeams: AgentScoreForTeams[] = agentScores.map(as => ({
        agentFirstName: as.agentFirstName,
        emojiString: as.isAbsent ? "N/A" : as.emojiString,
        totalPoints: as.totalPoints,
        isAbsent: as.isAbsent,
        teamEmoji: as.teamEmoji,
        completedTasks: as.completedTasks || [],
        targetProgress: as.targetProgress,
    }));
    const podTargetSummaryForTeams: PodTargetSummaryForTeams[] = [];
    const simpleTaskLogs: SimpleTaskLog[] = dailyTaskLogs.map(log => ({ agentId: log.agentId, taskId: log.taskId }));

    setIsSendingToTeams(true);
    try {
      await sendTeamsUpdate(
        podName,
        webhookUrl,
        selectedDate,
        rules,
        agentScoresForTeams,
        podTargetSummaryForTeams,
        simpleTaskLogs,
        teamBonusSummary,
        teamTotalScores, // Pass total scores
      );
      toast({ title: "Sent to Teams", description: "Daily scores summary has been sent." });
    } catch (err: any) {
      console.error("[DailyScoresPage] Error sending to Teams:", err);
      toast({ variant: "destructive", title: "Send Failed", description: err.message || "Could not send summary to Teams." });
    } finally {
      setIsSendingToTeams(false);
    }
  };


  const isLoadingDisplay = isLoadingPods || isLoadingData;
  const canDisplayTable = !isLoadingDisplay && selectedPodId && rules.length > 0 && agents.length > 0;
  const canSendToTeams = !isLoadingDisplay && !isSendingToTeams && selectedPodId && pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl && (agentScores.length > 0 || teamBonusSummary.length > 0);

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
                    <CardDescription>View daily scores and individual target progress for the selected pod and date.</CardDescription>
                </div>
                <Button
                    onClick={handleSendToTeams}
                    disabled={!canSendToTeams}
                    title={!selectedPodId ? "Select a pod first" : !pods.find(p => p.id === selectedPodId)?.teamsWebhookUrl ? "No webhook URL configured" : (agentScores.length === 0 && teamBonusSummary.length === 0) ? "No data to send" : "Send summary to Teams"}
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
                                <TableHead className="w-[30px]">Team</TableHead>
                                <TableHead className="w-[150px]">Agent</TableHead>
                                <TableHead>Achievements</TableHead>
                                <TableHead>Targets</TableHead>
                                <TableHead className="w-[100px] text-right">Total Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agentScores.map((score) => (
                            <TableRow key={score.agentId}>
                                <TableCell className="text-lg" title={teams.find(t => t.emoji === score.teamEmoji)?.name}>{score.teamEmoji || ''}</TableCell>
                                <TableCell className="font-medium">{score.agentFirstName}</TableCell>
                                <TableCell>
                                    {score.isAbsent ? (
                                        <span className="text-sm text-muted-foreground">N/A</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {Array.from(score.emojiString).map((emoji, index) => (
                                                <span key={`${score.agentId}-emoji-${index}`} className="text-lg" title={rules.find(r => r.type === 'numeric' && r.emoji === emoji)?.name}>
                                                    {emoji}
                                                </span>
                                            ))}
                                            {(score.completedTasks || []).map((task, index) => (
                                                <span key={`${score.agentId}-task-${index}`} className="text-lg" title={task.ruleName}>
                                                    {task.ruleEmoji}
                                                </span>
                                            ))}
                                            {score.emojiString === '' && (score.completedTasks || []).length === 0 && <span className="text-sm text-muted-foreground">-</span>}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {score.isAbsent ? 'N/A' : (score.targetProgress || '-')}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                    {score.isAbsent ? <span className="text-sm font-normal text-muted-foreground">N/A</span> : score.totalPoints}
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </>
            )}

             {!isLoadingDisplay && (teamBonusSummary.length > 0 || teamTotalScores.length > 0) && (
                <div className="mt-6 p-4 border-t">
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="h-4 w-4"/>Current Team Standings</h4>
                    <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
                        {teamTotalScores.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: ${s.totalPoints.toLocaleString()} pts`).join(' | ')}
                    </p>
                    {teamBonusSummary.length > 0 && (
                        <p className="text-xs whitespace-pre-wrap break-words mt-2">
                           <span className="font-medium">Today's Adjustments:</span> {teamBonusSummary.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: ${s.bonusPoints > 0 ? '+' : ''}${s.bonusPoints} pts`).join(' | ')}
                        </p>
                    )}
                </div>
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
                {!isLoadingDisplay && canDisplayTable && agentScores.length === 0 && competitionLogs.filter(log => startOfDay(log.date.toDate()).getTime() === startOfDay(selectedDate).getTime()).length === 0 && (
                    <p className="text-center text-muted-foreground mt-6">No achievements logged for this pod on this date.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
