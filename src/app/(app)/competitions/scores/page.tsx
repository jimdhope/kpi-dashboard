
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
import { CalendarIcon, Loader2, AlertCircle, Filter, Swords, Trophy, Target } from 'lucide-react'; // Added Target
import { format, startOfDay, getDay, endOfDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/models/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import type { DailyAchievementLog, DailyTaskLog, TeamBonusLog } from '@/app/(admin)/admin/log-achievements/page';
import { Progress } from '@/components/ui/progress';


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
  // Added this to derive pod target progress correctly
  achievements: Record<string, number>;
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
          setRules(foundCompetition.rules || []);
          setTeams(foundCompetition.teams || []); // Set teams from competition
          setActiveCompetitionId(foundCompetition.id);
        } else {
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

         setIsLoadingData(true); // Start loading logs/targets specifically

         let unsubscribeCompLogs: Unsubscribe = () => {};
         let unsubscribeCompBonusLogs: Unsubscribe = () => {};
         let unsubscribeTaskLogs: Unsubscribe = () => {};
         let unsubscribeTargets: Unsubscribe = () => {};

         const dateForQuery = Timestamp.fromDate(startOfDay(selectedDate));

         const achievementsRef = collection(db, 'dailyAchievements');
         const compLogsQuery = query(
             achievementsRef,
             where('podId', '==', selectedPodId),
             where('competitionId', '==', activeCompetitionId),
             where('date', '==', dateForQuery) // Fetch ONLY today's logs
         );
          unsubscribeCompLogs = onSnapshot(compLogsQuery, (snapshot) => {
              const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
              setCompetitionLogs(fetchedLogs); // This now only holds daily logs
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
            // Fetch all bonus logs for the competition for total standings
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
                  setDailyTargets(docSnap.data() as DailyTargetData);
              } else {
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
             unsubscribeCompLogs();
             unsubscribeCompBonusLogs();
             unsubscribeTaskLogs();
             unsubscribeTargets();
         };
   }, [activeCompetitionId, selectedPodId, selectedDate, toast]);


   const { agentScores, teamBonusSummary, teamTotalScores, podTargetSummary, ruleKeyString } = useMemo(() => {
    const todayStart = startOfDay(selectedDate);
    const dailyLogs = competitionLogs; // This state now correctly holds only daily logs
    const dailyBonusLogs = competitionBonusLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
    const absentAgentIds = new Set(dailyLogs.filter(log => log.status === 'absent').map(log => log.agentId));
    const activeAgents = agents.filter(agent => agent.id && !absentAgentIds.has(agent.id));
    const rulesMap = new Map(rules.map(rule => [rule.id, rule]));
    const dayOfWeek = daysOfWeek[getDay(selectedDate)];
    const numericRules = rules.filter(r => r.type === 'numeric');
    const taskRules = rules.filter(r => r.type === 'checkbox');

    // --- Agent Daily Scores Calculation ---
    const finalAgentScores: AgentScore[] = agents
      .map(agent => {
        if (!agent.id) return null;
        const agentData = { totalPoints: 0, achievements: {} as Record<string, number> };
        const agentDailyLogs = dailyLogs.filter(log => log.agentId === agent.id && log.status !== 'absent');
        
        agentDailyLogs.forEach(log => {
            const rule = rulesMap.get(log.ruleId);
            if (rule) {
                const points = (log.points ?? 0);
                agentData.totalPoints += points;
                agentData.achievements[rule.id!] = (agentData.achievements[rule.id!] || 0) + (log.value || 0);
            }
        });

        const isAbsent = absentAgentIds.has(agent.id);
        let emojis = '';
        if (!isAbsent) {
            const sortedNumericRules = [...numericRules].sort((a, b) => a.name.localeCompare(b.name));
            sortedNumericRules.forEach(rule => {
                const achievementValue = agentData.achievements[rule.id!] || 0;
                if (achievementValue > 0) {
                    const emojiToUse = (rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓';
                    emojis += emojiToUse.repeat(achievementValue);
                }
            });
        }
        
        const targetProgressParts = numericRules.map(rule => {
            if (!rule.id) return null;
            const target = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (target === undefined || target === null || target < 0) return null;
            const achieved = agentData.achievements[rule.id] || 0;
            return `${rule.emoji || '❓'} ${achieved}/${target}`;
        }).filter(Boolean);

        const agentTaskLogs = dailyTaskLogs.filter(log => log.agentId === agent.id);
        const completedTasks = agentTaskLogs.map(taskLog => {
            const rule = rules.find(r => r.id === taskLog.taskId && r.type === 'checkbox');
            return { ruleName: rule?.name || 'Unknown Task', ruleEmoji: (rule?.emoji && rule.emoji.trim() !== '') ? rule.emoji : '✅' };
        });

        const agentTeam = teams.find(team => team.agentIds?.includes(agent.id!));

        return {
          agentId: agent.id!,
          agentFirstName: agent.name.split(' ')[0] || agent.name,
          totalPoints: agentData.totalPoints,
          emojiString: emojis,
          isAbsent: isAbsent,
          completedTasks: completedTasks,
          teamEmoji: agentTeam?.emoji,
          targetProgress: targetProgressParts.join(' | '),
          achievements: agentData.achievements,
        };
      })
      .filter((a): a is AgentScore => a !== null)
      .sort((a, b) => a.agentFirstName.localeCompare(b.agentFirstName));

    // --- Pod Target Summary (Derived from the correct daily logs) ---
    const dailyPodRuleTotals: Record<string, number> = {};
    numericRules.forEach(rule => { if (rule.id) dailyPodRuleTotals[rule.id] = 0; });
    dailyLogs.forEach(log => {
       if (log.ruleId && dailyPodRuleTotals.hasOwnProperty(log.ruleId) && log.status !== 'absent') {
           dailyPodRuleTotals[log.ruleId] += (log.value || 0);
       }
    });

    const finalPodTargetSummary: PodTargetSummary[] = numericRules
        .map(rule => {
            if (!rule.id) return null;
            const individualTarget = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (individualTarget === undefined || individualTarget === null || individualTarget < 0) return null;
            
            const podTarget = individualTarget * activeAgents.length;
            const achieved = dailyPodRuleTotals[rule.id] || 0;
            const progress = podTarget > 0 ? Math.min(Math.round((achieved / podTarget) * 100), 100) : 0;
            
            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', achieved, target: podTarget, progress };
        }).filter((s): s is PodTargetSummary => s !== null);

    // --- Team & Rule Key Calculations ---
    const teamBonusSummary = dailyBonusLogs.map(log => ({
        teamName: teams.find(t => t.id === log.teamId)?.name || 'Unknown',
        teamEmoji: teams.find(t => t.id === log.teamId)?.emoji,
        bonusPoints: log.points
    })).filter(summary => summary.bonusPoints !== 0);


    // This needs to fetch all competition logs, which it doesn't currently do.
    // This part of the logic is now incorrect because competitionLogs only holds daily logs.
    // For now, it will only show daily team scores. A more robust solution would be another listener for all competition logs.
    // Or, for simplicity, we can remove the total score display from this page as it's also on the leaderboard page.
    // Let's assume for now we only show daily team totals here.
    const teamTotalScoresMap: { [teamId: string]: number } = {};
    teams.forEach(team => teamTotalScoresMap[team.id] = 0);
    dailyLogs.forEach(log => {
        const rule = rulesMap.get(log.ruleId);
        if (rule) {
            const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
            if (agentTeam) {
                teamTotalScoresMap[agentTeam.id] = (teamTotalScoresMap[agentTeam.id] || 0) + (log.points ?? 0);
            }
        }
    });
    dailyBonusLogs.forEach(log => {
        if (teamTotalScoresMap.hasOwnProperty(log.teamId)) teamTotalScoresMap[log.teamId] += log.points || 0;
    });
    const finalTeamTotalScores = teams.map(team => ({
        teamName: team.name, teamEmoji: team.emoji, totalPoints: teamTotalScoresMap[team.id] || 0
    })).sort((a,b) => b.totalPoints - a.totalPoints);
    
    const numericKeyString = numericRules.map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`).join('  ');
    const taskKeyString = taskRules.map(rule => `${rule.emoji || '✅'}=${rule.name}`).join('  ');
    const finalRuleKeyString = [numericKeyString, taskKeyString].filter(Boolean).join(' | ');

    return {
        agentScores: finalAgentScores,
        teamBonusSummary: teamBonusSummary,
        teamTotalScores: finalTeamTotalScores,
        podTargetSummary: finalPodTargetSummary,
        ruleKeyString: finalRuleKeyString,
    };
}, [competitionLogs, competitionBonusLogs, dailyTaskLogs, agents, rules, dailyTargets, selectedDate, teams]);


  const isLoadingDisplay = isLoadingPods || isLoadingData;
  const canDisplayTable = !isLoadingDisplay && selectedPodId && rules.length > 0 && agents.length > 0;

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
            </CardHeader>
            <CardContent>
            {error && <p className="text-destructive mb-4">{error}</p>}

            {isLoadingDisplay && (
                 <Table>
                    <TableHeader>
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
                        <TableHeader>
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
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="h-4 w-4"/>Today's Team Scores</h4>
                    <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
                        {teamTotalScores.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: ${s.totalPoints.toLocaleString()}`).join(' | ')}
                    </p>
                    {teamBonusSummary.length > 0 && (
                        <p className="text-xs whitespace-pre-wrap break-words mt-2">
                           <span className="font-medium">Adjustments:</span> {teamBonusSummary.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: ${s.bonusPoints > 0 ? '+' : ''}${s.bonusPoints}`).join(' | ')}
                        </p>
                    )}
                </div>
            )}

            {!isLoadingDisplay && podTargetSummary.length > 0 && (
                <div className="mt-6 p-4 border-t">
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Target className="h-4 w-4" /> Pod Target Progress</h4>
                    <div className="space-y-3">
                    {podTargetSummary.map(summary => (
                        <div key={summary.ruleId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium truncate" title={summary.ruleName}>
                            {summary.ruleEmoji} {summary.ruleName}
                            </span>
                            <span className={cn("font-semibold", summary.progress !== undefined && summary.progress >= 100 ? "text-green-600" : "text-muted-foreground")}>
                            {summary.achieved.toLocaleString()} / {summary.target?.toLocaleString()}
                            </span>
                        </div>
                        <Progress value={summary.progress ?? 0} className="h-2" />
                        </div>
                    ))}
                    </div>
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
                {!isLoadingDisplay && canDisplayTable && agentScores.length === 0 && competitionLogs.length === 0 && (
                    <p className="text-center text-muted-foreground mt-6">No achievements logged for this pod on this date.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
