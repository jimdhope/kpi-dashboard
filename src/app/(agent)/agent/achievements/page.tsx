
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
  setDoc,
  addDoc,
  orderBy,
  serverTimestamp,
  onSnapshot, // Added for user listener
  Unsubscribe, // Added for user listener
  deleteDoc, // Added deleteDoc
  limit, // Import limit
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, CheckSquare } from 'lucide-react'; // Added CheckSquare
import { format, startOfDay } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AchievementCard } from '@/components/achievement-card'; // Import AchievementCard

// Interface for the data stored in Firestore
interface DailyAchievementLog {
  id?: string; // Firestore ID
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string; // Store rule ID for better linking
  ruleName: string; // Store name for display convenience
  date: Timestamp; // Date the achievement occurred (start of day)
  value: number; // The actual achievement value logged
  points: number; // Calculated points based on rule and value
  loggedAt: Timestamp; // Timestamp when logged
  loggedBy?: string | null; // UID of user who logged it (could be self or admin)
}

// Interface for managing state within the component (simplified for single agent)
interface AgentAchievementInputState {
  [ruleId: string]: {
    value: number; // Use number directly for input value
    existingLogId?: string; // To know if we update or add
  };
}

export default function AgentLogAchievementsPage() {
  // selectedDate is removed as logging is always for "today"
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingCompetition, setIsLoadingCompetition] = useState(false);
  // isLoadingAchievements is effectively merged into isLoadingCompetition now
  const [isSaving, setIsSaving] = useState<{[key: string]: boolean}>({}); // Corrected type
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);

  // 1. Get current user and their pod ID
  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      let unsubscribeUserDoc: Unsubscribe = () => {};
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
              setCurrentUser(userData);
              setAgentPodId(userData.podId || null);
              if (!userData.podId) {
                  setError("You are not currently assigned to a pod. Cannot log achievements.");
              }
               setError(null);
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
           return unsubscribeUserDoc;
        } catch (err) {
            console.error("Error setting up user listener:", err);
            setError("Failed to load your profile information.");
            setCurrentUser(null);
            setAgentPodId(null);
            setIsLoadingUser(false);
        }
      } else {
         setError("You must be logged in to log achievements.");
         setCurrentUser(null);
         setAgentPodId(null);
         setIsLoadingUser(false);
      }
       return unsubscribeUserDoc;
    });
    return () => unsubscribeAuth();
  }, []);


  // 2. Fetch Competition Rules and Existing Achievements based on Pod ID and Date (always for today)
  useEffect(() => {
    if (!agentPodId || !currentUser?.id || isLoadingUser) {
        setCompetitionRules([]);
        setAchievementInputs({});
        setActiveCompetitionId(null);
        if (!isLoadingUser && agentPodId === null) {
            // Error already set
        }
        return;
    }

    const fetchCompetitionAndAchievements = async () => {
      setIsLoadingCompetition(true);
      // setIsLoadingAchievements(true); // Merged
      setError(null);
      setCompetitionRules([]);
      setAchievementInputs({});
      setActiveCompetitionId(null);
      const todayStart = startOfDay(new Date()); // Always use today's date

      try {
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(todayStart);
        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', agentPodId),
          where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc') // Get most recent starting one first
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let activeCompetition: (Competition & { id: string }) | null = null;

        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string };
            if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= todayStart) {
                activeCompetition = comp;
                break; // Found the current active one
            }
        }
        console.log(`Agent: Active competition on ${todayStart.toLocaleDateString()}:`, activeCompetition?.name);
        setActiveCompetitionId(activeCompetition?.id || null);

        if (activeCompetition) {
          const filteredRules = (activeCompetition.rules || []).filter(rule => rule.name.toLowerCase() !== 'bonus');
          setCompetitionRules(filteredRules);

          const achievementsRef = collection(db, 'dailyAchievements');
          const achievementsQuery = query(
            achievementsRef,
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id)
          );
          const achievementsSnapshot = await getDocs(achievementsQuery);
          const existingAchievements = achievementsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DailyAchievementLog));

          const initialInputs: AgentAchievementInputState = {};
          filteredRules.forEach(rule => {
            if (!rule.id) return;
            const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
            initialInputs[rule.id] = {
              value: existingLog ? existingLog.value : 0, // Default to 0 if no log
              existingLogId: existingLog?.id,
            };
          });
          setAchievementInputs(initialInputs);

        } else {
          setCompetitionRules([]);
          toast({ variant: "default", title: "No Active Competition", description: `No competition found for your pod active today.` });
        }

      } catch (err) {
        console.error("Error fetching competition/achievements:", err);
        setError("Failed to load competition or achievement data.");
        toast({ variant: "destructive", title: "Error", description: "Could not load necessary data." });
        setCompetitionRules([]);
        setAchievementInputs({});
        setActiveCompetitionId(null);
      } finally {
        setIsLoadingCompetition(false);
        // setIsLoadingAchievements(false); // Merged
      }
    };

    fetchCompetitionAndAchievements();
  }, [agentPodId, currentUser?.id, isLoadingUser, toast]);


  const handleValueChange = useCallback((ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change); // Ensure value doesn't go below 0

    setAchievementInputs(prev => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], value: newValue },
    }));
    debouncedSave(ruleId, newValue);
  }, [achievementInputs, competitionRules, agentPodId, currentUser?.id, activeCompetitionId]); // Add all dependencies for debouncedSave


  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const handleSaveAchievement = async (ruleId: string, value: number) => {
    if (!agentPodId || !currentUser?.id || !activeCompetitionId) {
      console.error("Pod, user, or active competition information missing for auto-save.");
      return;
    }

    const rule = competitionRules.find(r => r.id === ruleId);
    const agentInput = achievementInputs[ruleId]; // This might be slightly stale due to closure, but `value` is current

    if (!rule) {
      console.error("Rule or input data not found for auto-save.");
      return;
    }

    // Value is already validated as non-negative number by handleValueChange
    setIsSaving(prev => ({ ...prev, [ruleId]: true }));

    try {
      const points = rule.points * value;
      const dateTimestamp = Timestamp.fromDate(startOfDay(new Date())); // Always log for "today"

      const logEntry: Omit<DailyAchievementLog, 'id'> = {
        agentId: currentUser.id,
        podId: agentPodId,
        competitionId: activeCompetitionId,
        ruleId: rule.id!,
        ruleName: rule.name,
        date: dateTimestamp,
        value: value,
        points: points,
        loggedAt: serverTimestamp(),
        loggedBy: currentUser.uid,
      };

      const achievementsRef = collection(db, 'dailyAchievements');
      const existingLogId = achievementInputs[ruleId]?.existingLogId; // Get potentially stale ID

      if (existingLogId) {
        const docRef = doc(achievementsRef, existingLogId);
        if (value > 0) {
          await setDoc(docRef, logEntry, { merge: true });
        } else {
          await deleteDoc(docRef); // Delete if value is 0
          // Update state immediately to remove existingLogId
          setAchievementInputs(prev => {
              const newState = { ...prev };
              if (newState[ruleId]) {
                  newState[ruleId] = { ...newState[ruleId], existingLogId: undefined };
              }
              return newState;
          });
        }
      } else if (value > 0) { // Only create if value > 0 and no existing log
         const addedDoc = await addDoc(achievementsRef, logEntry);
          setAchievementInputs(prev => {
              const newState = { ...prev };
              if (!newState[ruleId]) { // Should not happen if initialized correctly
                   newState[ruleId] = { value: value, existingLogId: addedDoc.id };
              } else {
                   newState[ruleId].existingLogId = addedDoc.id;
              }
              return newState;
          });
      }

    } catch (err) {
      console.error("Error auto-saving achievement:", err);
       toast({ variant: "destructive", title: "Auto-Save Failed", description: `Could not save ${rule.name}.` });
    } finally {
      setIsSaving(prev => ({ ...prev, [ruleId]: false }));
    }
  };

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000),
    [agentPodId, currentUser?.id, competitionRules, achievementInputs, activeCompetitionId, toast] // Dependencies updated
  );

  const isLoading = isLoadingUser || isLoadingCompetition;
  const canLog = !isLoading && currentUser && agentPodId && competitionRules.length > 0 && activeCompetitionId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
                 <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5"/>Today&apos;s Achievements</CardTitle>
                 {/* Removed CardDescription with date */}
            </div>
            {/* Display Daily Score - calculation needed in parent AgentDashboard or here */}
            {/* <div className="text-right">
                 {isLoading ? (
                    <Skeleton className="h-6 w-16 rounded mt-1"/>
                 ) : (
                    <p className="text-2xl font-bold text-primary">{dailyTotalPointsFromParentOrCalc.toLocaleString()} pts</p>
                 )}
            </div> */}
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive mb-4">{error}</p>}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={`log-skeleton-${index}`} className="h-[130px] w-full" />
                ))}
            </div>
          ) : !canLog && !error && !isLoadingUser && !agentPodId ? (
                <p className="text-muted-foreground text-center py-6">You are not assigned to a pod. Please contact your manager.</p>
          ) : !canLog && !error ? (
             <p className="text-muted-foreground text-center py-6">
                {activeCompetitionId === null ? `No competition found for your pod active today.` : "No competition rules found for logging."}
             </p>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {competitionRules.map((rule) => (
                    rule.id ? (
                        <AchievementCard
                            key={rule.id}
                            rule={rule}
                            currentValue={achievementInputs[rule.id]?.value ?? 0}
                            isSaving={isSaving[rule.id] || false}
                            onIncrement={() => handleValueChange(rule.id!, 1)}
                            onDecrement={() => handleValueChange(rule.id!, -1)}
                        />
                    ) : null
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
