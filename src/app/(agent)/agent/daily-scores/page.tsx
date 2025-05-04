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
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Trophy, Target } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Interface for daily achievement logs (same as admin)
interface DailyAchievementLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName: string;
  date: Timestamp;
  value: number;
  points: number;
  loggedAt: Timestamp;
  loggedBy?: string | null;
}

// Interface for processed agent scores (simplified for single agent view)
interface AgentScore {
  agentId: string;
  agentFirstName: string;
  totalPoints: number;
  emojiString: string;
}

// Interface for pod target summary (same as admin)
interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  target: number | null;
}

// Extend Competition interface to include podTargets (same as admin)
interface CompetitionWithTargets extends Competition {
    podTargets?: Record<string, number>; // ruleId -> targetValue
}

export default function AgentDailyScoresPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]); // Only logs for the current user
  const [podTargets, setPodTargets] = useState<Record<string, number>>({});
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]); // Logs for the entire pod (for target summary)
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Get current user and their pod ID
  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
            setCurrentUser(userData);
            setAgentPodId(userData.podId || null);
            if (!userData.podId) {
              setError("You are not currently assigned to a pod.");
            }
             setError(null);
          } else {
             setError("Could not find your user profile.");
             setCurrentUser(null);
             setAgentPodId(null);
          }
        } catch (err) {
            console.error("Error fetching user data:", err);
            setError("Failed to load your profile information.");
            setCurrentUser(null);
            setAgentPodId(null);
        }
      } else {
         setError("You must be logged in.");
         setCurrentUser(null);
         setAgentPodId(null);
      }
      setIsLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Competition Rules, Logs (User & Pod), and Targets
  useEffect(() => {
    if (!agentPodId || !currentUser?.id) {
      setRules([]);
      setDailyLogs([]);
      setPodLogs([]);
      setPodTargets({});
      return;
    }

    const fetchScoreData = async () => {
      setIsLoadingData(true);
      setError(null);
      setRules([]);
      setDailyLogs([]);
      setPodLogs([]);
      setPodTargets({});

      try {
        // Find Active Competition
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const competitionQuery = query(
          competitionsRef,
          where('podId', '==', agentPodId),
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
          setPodTargets(activeCompetition.podTargets || {});

          // Fetch Achievements for the specific agent AND the entire pod
          const achievementsRef = collection(db, 'dailyAchievements');

          // User Logs
          const userLogsQuery = query(
            achievementsRef,
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );
          const userLogsSnapshot = await getDocs(userLogsQuery);
          const fetchedUserLogs = userLogsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
          setDailyLogs(fetchedUserLogs);

           // Pod Logs (for target summary)
           const podLogsQuery = query(
            achievementsRef,
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );
          const podLogsSnapshot = await getDocs(podLogsQuery);
          const fetchedPodLogs = podLogsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
          setPodLogs(fetchedPodLogs);


        } else {
          setRules([]);
          setDailyLogs([]);
          setPodLogs([]);
          setPodTargets({});
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for your pod on this date." });
        }

      } catch (err) {
        console.error("Error fetching score data:", err);
        setError("Failed to load data.");
        setRules([]);
        setDailyLogs([]);
        setPodLogs([]);
        setPodTargets({});
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchScoreData();
  }, [agentPodId, selectedDate, currentUser?.id, toast]);

  // 3. Process data for the agent's view and pod summary
  const { agentScore, podTargetSummary } = useMemo(() => {
    // Calculate agent's score and emoji string
    let currentAgentScore: Omit<AgentScore, 'agentId' | 'agentFirstName'> = { totalPoints: 0, emojiString: '' };
    let agentEmojis = '';
     // Sort rules for consistent emoji order? Optional.
    const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));

    sortedRules.forEach(rule => {
       if (!rule.id) return;
        const logForRule = dailyLogs.find(log => log.ruleId === rule.id);
        if (logForRule) {
             currentAgentScore.totalPoints += logForRule.points;
             if (logForRule.value > 0) {
                agentEmojis += (rule.emoji || '❓').repeat(logForRule.value);
             }
        }
    });
    currentAgentScore.emojiString = agentEmojis;

    const finalAgentScore : AgentScore | null = currentUser ? {
         agentId: currentUser.id!,
         agentFirstName: currentUser.name.split(' ')[0] || currentUser.name,
         ...currentAgentScore
    } : null;


    // Calculate Pod Target Summary (using podLogs)
    const ruleTotals: Record<string, number> = {};
    rules.forEach(rule => {
        if(rule.id) ruleTotals[rule.id] = 0;
    });
    podLogs.forEach(log => {
      if (ruleTotals.hasOwnProperty(log.ruleId)) {
         ruleTotals[log.ruleId] += log.value;
      }
    });

    const finalPodTargetSummary: PodTargetSummary[] = rules
        .map(rule => {
            if (!rule.id) return null;
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleEmoji: rule.emoji || '❓',
                achieved: ruleTotals[rule.id] || 0,
                target: podTargets[rule.id] ?? null,
            };
        })
         .filter((item): item is PodTargetSummary => item !== null)
         .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

    return { agentScore: finalAgentScore, podTargetSummary: finalPodTargetSummary };
  }, [dailyLogs, podLogs, rules, podTargets, currentUser]);

  const isLoading = isLoadingUser || isLoadingData;
  const canDisplay = !isLoading && currentUser && agentPodId && rules.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Daily Score</CardTitle>
          <CardDescription>View your score and pod target progress for the selected date.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Date Select */}
          <div className="mb-6">
            <Label htmlFor="date-select">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-select"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal mt-2",
                    !selectedDate && "text-muted-foreground"
                  )}
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

          {error && <p className="text-destructive mb-4">{error}</p>}

          {/* Loading State */}
          {isLoading && (
             <div className="space-y-4">
               <Skeleton className="h-6 w-3/4 mb-4" /> {/* Key skeleton */}
               <Skeleton className="h-12 w-full" /> {/* User score skeleton */}
               <Skeleton className="h-8 w-full mt-6" /> {/* Footer skeleton */}
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

          {/* Agent Score Display */}
          {canDisplay && agentScore && (
            <Card className="mb-6 bg-card">
               <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                         <div>
                            <h3 className="text-xl font-semibold">{agentScore.agentFirstName}'s Score</h3>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {agentScore.emojiString.split('').map((emoji, index) => (
                                    <span key={index} className="text-2xl" title={rules.find(r => r.emoji === emoji)?.name}>
                                        {emoji}
                                    </span>
                                ))}
                                {agentScore.emojiString.length === 0 && <span className="text-base text-muted-foreground">-</span>}
                            </div>
                         </div>
                         <div className="text-right flex-shrink-0">
                             <p className="text-3xl font-bold text-primary">{agentScore.totalPoints}</p>
                             <p className="text-sm text-muted-foreground">Total Points</p>
                         </div>
                    </div>
                </CardContent>
            </Card>
          )}

           {/* Pod Target Summary Footer */}
           {!isLoading && podTargetSummary.length > 0 && (
             <div className="mt-6 p-4 border rounded-md">
                <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-muted-foreground"/> Pod Target Summary
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
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

            {/* No Data States */}
           {!isLoading && !agentPodId && !isLoadingUser && (
                <p className="text-center text-muted-foreground mt-6">You are not assigned to a pod. Please contact your manager.</p>
            )}
           {!isLoading && agentPodId && rules.length === 0 && !error && (
                 <p className="text-center text-muted-foreground mt-6">No active competition found for your pod on this date.</p>
            )}
             {!isLoading && canDisplay && dailyLogs.length === 0 && (
                 <p className="text-center text-muted-foreground mt-6">You haven't logged any achievements for this date yet.</p>
            )}

        </CardContent>
      </Card>
    </div>
  );
}
