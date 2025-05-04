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
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      let unsubscribeUserDoc: Unsubscribe = () => {}; // Initialize for cleanup
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          // Use onSnapshot for the user document to potentially react to podId changes
          unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
              setCurrentUser(userData);
              setAgentPodId(userData.podId || null);
              if (!userData.podId) {
                setError("You are not currently assigned to a pod.");
              } else {
                setError(null);
              }
            } else {
               setError("Could not find your user profile.");
               setCurrentUser(null);
               setAgentPodId(null);
            }
             setIsLoadingUser(false); // User data loaded/updated
          }, (err) => {
             console.error("Error listening to user document:", err);
             setError("Failed to load your profile information.");
             setCurrentUser(null);
             setAgentPodId(null);
             setIsLoadingUser(false);
          });
           // Return the user doc listener cleanup function
           return unsubscribeUserDoc;
        } catch (err) {
            console.error("Error setting up user listener:", err);
            setError("Failed to load your profile information.");
            setCurrentUser(null);
            setAgentPodId(null);
            setIsLoadingUser(false);
        }
      } else {
         setError("You must be logged in.");
         setCurrentUser(null);
         setAgentPodId(null);
         setIsLoadingUser(false);
      }
       // Ensure inner unsubscribe is returned
       return unsubscribeUserDoc;
    });
     // Return the outer unsubscribe function for the auth listener
    return () => unsubscribeAuth();
  }, []);

  // 2. Fetch Competition Rules, Listen to Logs (User & Pod), and Targets
  useEffect(() => {
    if (!agentPodId || !currentUser?.id) {
      setRules([]);
      setDailyLogs([]);
      setPodLogs([]);
      setPodTargets({});
      return () => {}; // Return empty cleanup function
    }

    setIsLoadingData(true);
    setError(null);
    // Reset previous state, listeners will populate
    setRules([]);
    setDailyLogs([]);
    setPodLogs([]);
    setPodTargets({});

    let unsubscribeUserLogs: Unsubscribe = () => {};
    let unsubscribePodLogs: Unsubscribe = () => {};

    const fetchAndListen = async () => {

      try {
        // Find Active Competition (can remain getDocs)
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

          // Listen to Achievements for the specific agent
          const achievementsRef = collection(db, 'dailyAchievements');
          const userLogsQuery = query(
            achievementsRef,
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );
           unsubscribeUserLogs = onSnapshot(userLogsQuery, (snapshot) => {
             const fetchedUserLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
             setDailyLogs(fetchedUserLogs);
             // Consider setting loading false only after both listeners have fired once
             // setIsLoadingData(false); // Moved below
           }, (err) => {
              console.error("Error listening to user logs:", err);
              setError("Failed to load your achievement data.");
              setIsLoadingData(false);
           });


           // Listen to Pod Logs (for target summary)
           const podLogsQuery = query(
            achievementsRef,
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );
           unsubscribePodLogs = onSnapshot(podLogsQuery, (snapshot) => {
             const fetchedPodLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
             setPodLogs(fetchedPodLogs);
             setIsLoadingData(false); // Set loading false after pod logs update
             setError(null); // Clear error on success
           }, (err) => {
              console.error("Error listening to pod logs:", err);
              setError("Failed to load pod achievement data.");
              setIsLoadingData(false);
           });


        } else {
          setRules([]);
          setDailyLogs([]);
          setPodLogs([]);
          setPodTargets({});
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for your pod on this date." });
          setIsLoadingData(false); // Stop loading if no competition
        }

      } catch (err) {
        console.error("Error fetching initial score data:", err);
        setError("Failed to load data.");
        setRules([]);
        setDailyLogs([]);
        setPodLogs([]);
        setPodTargets({});
        setIsLoadingData(false); // Stop loading on error
      }
      // Don't set isLoadingData false here, listeners will do it
    };

    fetchAndListen();

     // Cleanup function for the listeners
     return () => {
         console.log("Unsubscribing from user and pod logs listeners");
         unsubscribeUserLogs();
         unsubscribePodLogs();
     };

  }, [agentPodId, selectedDate, currentUser?.id, toast]); // Re-run when these dependencies change

  // 3. Process data (Memoization remains the same)
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
                 // Use emoji if it exists and is not empty, otherwise use fallback
                 const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                 agentEmojis += emojiToUse.repeat(logForRule.value);
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
             // Use emoji if it exists and is not empty, otherwise use fallback
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
                    {/* Use emoji if it exists and is not empty, otherwise use fallback */}
                    {(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = {rule.name} ({rule.points} pts)
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
