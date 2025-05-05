
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
import { format, startOfDay, getDay } from 'date-fns'; // Added getDay
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page'; // Import new target type

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

// Competition interface (no podTargets needed)
interface CompetitionWithRules extends Competition {
    // No podTargets needed here anymore
}

// Days of the week map
const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];


export default function AgentDailyScoresPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]); // Only logs for the current user
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]); // Logs for the entire pod (for target summary)
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null); // State for daily targets
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. Get current user and their pod ID (remains the same)
  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
       let unsubscribeUserDoc: Unsubscribe = () => {}; // Initialize for cleanup
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
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
           setIsLoadingUser(false);
        }, (err) => {
           console.error("Error listening to user document:", err);
           setError("Failed to load your profile information.");
           setCurrentUser(null);
           setAgentPodId(null);
           setIsLoadingUser(false);
        });
      } else {
         setError("You must be logged in.");
         setCurrentUser(null);
         setAgentPodId(null);
         setIsLoadingUser(false);
      }
       // Return the inner unsubscribe function for the doc listener
        return () => {
            if(unsubscribeUserDoc){
                unsubscribeUserDoc();
            }
        };
    });
    return () => unsubscribeAuth();
  }, []);


  // 2. Fetch Competition Rules, Listen to Logs (User & Pod), and Daily Targets
  useEffect(() => {
    // Initial check: Don't proceed if pod ID or user ID is missing
    if (!agentPodId || !currentUser?.id) {
      setRules([]);
      setDailyLogs([]);
      setPodLogs([]);
      setDailyTargets(null); // Clear targets
       // If user loading is done and there's no pod ID, error is likely set already
       if (!isLoadingUser && !agentPodId) {
         setIsLoadingData(false); // Ensure loading is false if we bail early
       }
      return () => {}; // Return empty cleanup function
    }

    setIsLoadingData(true); // Set loading true only when we intend to fetch
    setError(null);
    setRules([]);
    setDailyLogs([]);
    setPodLogs([]);
    setDailyTargets(null); // Reset targets

    let unsubscribeUserLogs: Unsubscribe = () => {};
    let unsubscribePodLogs: Unsubscribe = () => {};
    let unsubscribeTargets: Unsubscribe = () => {}; // Initialize unsubscribe function for targets

    const fetchAndListen = async () => {
      // *** Add extra check here within the async function ***
       if (!agentPodId) {
          console.warn("fetchAndListen called but agentPodId is null/undefined.");
          setIsLoadingData(false);
          return; // Prevent Firestore queries with invalid podId
       }

      try {
        // Find Active Competition (use array-contains for podIds)
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', agentPodId), // Check if podId is in the podIds array
          where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let activeCompetition: CompetitionWithRules | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules & { id: string };
             // Ensure comp.endDate exists and is a Timestamp before calling .toDate()
            if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= dateTimestamp) {
                activeCompetition = comp;
                break;
            }
        }


        if (activeCompetition) {
          setRules(activeCompetition.rules || []);

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
             // setIsLoadingData(false); // Moved below
           }, (err) => {
              console.error("Error listening to pod logs:", err);
              setError("Failed to load pod achievement data.");
              setIsLoadingData(false);
           });

            // Listen to Daily Targets document
            const targetsDocId = `${activeCompetition.id}_${agentPodId}`;
            const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
            unsubscribeTargets = onSnapshot(targetsDocRef, (docSnap) => {
                 if (docSnap.exists()) {
                     console.log("Daily targets data received:", docSnap.data());
                     setDailyTargets(docSnap.data() as DailyTargetData);
                 } else {
                     console.log("No daily targets document found for:", targetsDocId);
                     setDailyTargets(null);
                 }
                 setIsLoadingData(false); // Loading complete after logs and targets listeners fired
                 setError(null);
            }, (err) => {
                 console.error("Error listening to daily targets:", err);
                 setError("Failed to load daily target data.");
                 setDailyTargets(null);
                 setIsLoadingData(false);
            });


        } else {
          setRules([]);
          setDailyLogs([]);
          setPodLogs([]);
          setDailyTargets(null); // Clear targets
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for your pod on this date." });
          setIsLoadingData(false);
        }

      } catch (err) {
        console.error("Error fetching initial score data:", err);
        setError("Failed to load data.");
        setRules([]);
        setDailyLogs([]);
        setPodLogs([]);
        setDailyTargets(null); // Clear targets
        setIsLoadingData(false);
      }
    };

    fetchAndListen();

     // Cleanup function for the listeners
     return () => {
         console.log("Unsubscribing from user, pod logs, and targets listeners");
         unsubscribeUserLogs();
         unsubscribePodLogs();
         unsubscribeTargets();
     };

  }, [agentPodId, selectedDate, currentUser?.id, toast, isLoadingUser]); // Add isLoadingUser dependency


  // 3. Process data (Memoization adjusted for new targets)
  const { agentScore, podTargetSummary } = useMemo(() => {
    // Calculate agent's score and emoji string
    let currentAgentScore: Omit<AgentScore, 'agentId' | 'agentFirstName'> = { totalPoints: 0, emojiString: '' };
    let agentEmojis = '';
    const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));

    sortedRules.forEach(rule => {
       if (!rule.id) return;
        const logForRule = dailyLogs.find(log => log.ruleId === rule.id);
        if (logForRule) {
             currentAgentScore.totalPoints += logForRule.points;
             if (logForRule.value > 0) {
                 const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                 for (let i = 0; i < logForRule.value; i++) {
                    agentEmojis += emojiToUse;
                }
             }
        }
    });
    currentAgentScore.emojiString = agentEmojis;

    const finalAgentScore : AgentScore | null = currentUser ? {
         agentId: currentUser.id!,
         agentFirstName: currentUser.name.split(' ')[0] || currentUser.name,
         ...currentAgentScore
    } : null;


    // Calculate Pod Target Summary (using podLogs) - FILTERED based on dailyTargets for the selected day
    const dayOfWeek = daysOfWeek[getDay(selectedDate)]; // Get 'mon', 'tue', etc.
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
            const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
            // Only include if a target is explicitly set for this day
            if (targetValue === undefined || targetValue === null) {
                 return null;
            }
            const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleEmoji: emojiToUse,
                achieved: ruleTotals[rule.id] || 0,
                target: targetValue,
            };
        })
         .filter((item): item is PodTargetSummary => item !== null)
         .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

    return { agentScore: finalAgentScore, podTargetSummary: finalPodTargetSummary };
  }, [dailyLogs, podLogs, rules, dailyTargets, currentUser, selectedDate]); // Added selectedDate dependency

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
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {rules.map(rule => (
                  <span key={rule.id} className="whitespace-nowrap">
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
                                {Array.from(agentScore.emojiString).map((emoji, index) => (
                                    <span key={`${agentScore.agentId}-emoji-${index}`} className="text-2xl" title={rules.find(r => r.emoji === emoji)?.name}>
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

           {/* Pod Target Summary Footer - Render only if targets exist for the day */}
           {!isLoading && podTargetSummary.length > 0 && (
             <div className="mt-6 p-4 border rounded-md">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {podTargetSummary.map(summary => (
                        <div key={summary.ruleId} className="flex items-center whitespace-nowrap">
                            <span className="font-medium truncate" title={summary.ruleName}>
                                {summary.ruleEmoji} {summary.ruleName}
                            </span>
                            <span className={cn("font-semibold ml-2", summary.target !== null && summary.achieved >= summary.target ? "text-green-600" : "text-muted-foreground")}>
                                {summary.achieved}
                                {summary.target !== null ? ` / ${summary.target}` : ''}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            )}
             {/* Show message if no targets are set for the selected day */}
             {!isLoading && rules.length > 0 && podTargetSummary.length === 0 && (
                 <div className="mt-6 p-4 border-t">
                      <p className="text-sm text-muted-foreground">No pod targets set for this specific day.</p>
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


