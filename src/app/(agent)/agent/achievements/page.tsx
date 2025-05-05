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
  onSnapshot, // Added onSnapshot import
  Unsubscribe, // Keep Unsubscribe
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// Input is no longer needed here import { Input } from '@/components/ui/input';
// Table components are no longer needed
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AchievementCard } from '@/components/achievement-card'; // Import the new card component

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
    value: number; // Store as number now
    existingLogId?: string; // To know if we update or add
  };
}

export default function AgentLogAchievementsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date())); // Default to today
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AgentAchievementInputState>({});
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingCompetition, setIsLoadingCompetition] = useState(false);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({}); // Correct syntax
  const [error, setError] = useState<string | null>(null); // Correct syntax
  const { toast } = useToast();

  // 1. Get current user and their pod ID
  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      let unsubscribeUserDoc: Unsubscribe = () => {}; // Initialize for cleanup
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
              setCurrentUser(userData);
              setAgentPodId(userData.podId || null); // Set podId from user data
              if (!userData.podId) {
                  setError("You are not currently assigned to a pod. Cannot log achievements.");
              } else {
                setError(null); // Clear previous errors if podId exists
              }
            } else {
               setError("Could not find your user profile.");
               setCurrentUser(null);
               setAgentPodId(null);
            }
            setIsLoadingUser(false); // Mark as loaded regardless of profile existence
          }, (err) => {
             console.error("Error listening to user document:", err);
             setError("Failed to load your profile information.");
             setCurrentUser(null);
             setAgentPodId(null);
             setIsLoadingUser(false);
          });
           // Return the user doc listener cleanup function
           // Removed redundant return unsubscribeUserDoc;
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
       // Ensure inner unsubscribe is returned correctly
        return () => {
            if(unsubscribeUserDoc){
                unsubscribeUserDoc();
            }
        };
    });
    return () => unsubscribeAuth(); // Cleanup auth listener
  }, []);


  // 2. Fetch Competition Rules and Existing Achievements based on Pod ID and Date
  useEffect(() => {
    if (!agentPodId || !currentUser?.id) {
        setCompetitionRules([]);
        setAchievementInputs({});
        // Don't show error here if still loading user or user has no pod
        if (!isLoadingUser && agentPodId === null) {
             // Error already set in user fetch effect
        }
        return;
    }

    const fetchCompetitionAndAchievements = async () => {
      setIsLoadingCompetition(true);
      setIsLoadingAchievements(true);
      setError(null); // Clear previous errors
      setCompetitionRules([]);
      setAchievementInputs({});

      try {
        // Find the active Competition for the Pod and Date
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
         // Updated query to use array-contains for podIds
        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', agentPodId), // Check if agent's podId is in the podIds array
          where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let activeCompetition: (Competition & { id: string }) | null = null;
        for (const docSnap of competitionSnapshot.docs) {
          const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string };
           // Ensure endDate exists and is a Timestamp before calling toDate()
          if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= dateTimestamp) {
            activeCompetition = comp;
            break;
          }
        }

        if (activeCompetition) {
          setCompetitionRules(activeCompetition.rules || []);

          // Fetch Existing Achievements for this agent, pod, and date
          const achievementsRef = collection(db, 'dailyAchievements');
          const achievementsQuery = query(
            achievementsRef,
            where('agentId', '==', currentUser.id), // Filter by current agent ID
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetition.id) // Ensure it's for the correct competition
          );
          const achievementsSnapshot = await getDocs(achievementsQuery);
          const existingAchievements = achievementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));

          // Initialize Input State based on fetched rules and existing logs
          const initialInputs: AgentAchievementInputState = {};
          (activeCompetition.rules || []).forEach(rule => {
            if (!rule.id) return; // Skip rule if ID is missing
            const existingLog = existingAchievements.find(log => log.ruleId === rule.id);
            initialInputs[rule.id] = {
              value: existingLog ? existingLog.value : 0, // Store as number, default 0
              existingLogId: existingLog?.id,
            };
          });
          setAchievementInputs(initialInputs);

        } else {
          setCompetitionRules([]);
          toast({ variant: "default", title: "No Active Competition", description: "No competition found for your pod and this date. Cannot log achievements." });
        }

      } catch (err) {
        console.error("Error fetching competition/achievements:", err);
        setError("Failed to load competition or achievement data.");
        toast({ variant: "destructive", title: "Error", description: "Could not load necessary data." });
        setCompetitionRules([]);
        setAchievementInputs({});
      } finally {
        setIsLoadingCompetition(false);
        setIsLoadingAchievements(false);
      }
    };

    fetchCompetitionAndAchievements();
  }, [agentPodId, selectedDate, currentUser?.id, isLoadingUser, toast]); // Re-run when podId, date, or user changes

  // 3. Handle Increment/Decrement and Debounced Save
  const handleValueChange = (ruleId: string, change: number) => {
    const currentValue = achievementInputs[ruleId]?.value ?? 0;
    const newValue = Math.max(0, currentValue + change); // Ensure value doesn't go below 0

    setAchievementInputs(prev => ({
      ...prev,
      [ruleId]: {
        ...prev[ruleId],
        value: newValue,
      },
    }));
    debouncedSave(ruleId, newValue); // Pass the new numeric value directly
  };

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(null, args);
      }, delay);
    };
  };

  const handleSaveAchievement = async (ruleId: string, value: number) => { // value is now number
    if (!agentPodId || !currentUser?.id) {
      console.error("Pod or user information missing for auto-save.");
      return;
    }

    const rule = competitionRules.find(r => r.id === ruleId);
    const agentInput = achievementInputs[ruleId]; // Get the potentially updated input state

    if (!rule || agentInput === undefined) {
      console.error("Rule or input data not found for auto-save.");
      return;
    }

     // Value is already a number, no need to parse, but check validity
     if (isNaN(value) || value < 0) {
       console.warn("Invalid input value for auto-save:", value);
      return;
    }

     // Find active competition ID again
     const competitionsRef = collection(db, 'competitions');
     const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
     const competitionQuery = query(competitionsRef, where('podIds', 'array-contains', agentPodId), where('startDate', '<=', dateTimestamp), orderBy('startDate', 'desc'));
     const competitionSnapshot = await getDocs(competitionQuery);
     let activeCompetitionId: string | null = null;
     for (const docSnap of competitionSnapshot.docs) {
         const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string };
         if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= dateTimestamp) {
             activeCompetitionId = comp.id;
             break;
         }
     }

    if (!activeCompetitionId) {
       console.error("No active competition found for auto-save.");
      return;
    }

    setIsSaving(prev => ({ ...prev, [ruleId]: true }));

    try {
      const points = rule.points * value;
      const logEntry: Omit<DailyAchievementLog, 'id'> = {
        agentId: currentUser.id,
        podId: agentPodId,
        competitionId: activeCompetitionId,
        ruleId: rule.id!,
        ruleName: rule.name,
        date: dateTimestamp,
        value: value, // Use the numeric value
        points: points,
        loggedAt: serverTimestamp(),
        loggedBy: currentUser.uid, // Agent logs their own
      };

      const achievementsRef = collection(db, 'dailyAchievements');
      let docRef;
      const existingLogId = agentInput.existingLogId; // Get the potentially updated log ID

      if (existingLogId) {
        docRef = doc(achievementsRef, existingLogId);
        await setDoc(docRef, logEntry, { merge: true });
      } else if (value > 0) {
         const addedDoc = await addDoc(achievementsRef, logEntry);
          // Update state with the new ID immediately for subsequent saves
          setAchievementInputs(prev => {
              const newState = { ...prev };
              if (newState[ruleId]) {
                  newState[ruleId].existingLogId = addedDoc.id;
              }
              return newState;
          });
      } else {
          // Value is 0, no existing log, do nothing silently
      }

    } catch (err) {
      console.error("Error auto-saving achievement:", err);
       toast({ variant: "destructive", title: "Auto-Save Failed", description: `Could not save ${rule.name}.` });
    } finally {
      setIsSaving(prev => ({ ...prev, [ruleId]: false }));
    }
  };

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000),
    [agentPodId, currentUser?.id, competitionRules, achievementInputs, selectedDate, toast]
  );

  const isLoading = isLoadingUser || isLoadingCompetition || isLoadingAchievements;
  const canLog = !isLoading && currentUser && agentPodId && competitionRules.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Log Your Achievements</CardTitle>
          <CardDescription>Select the date and use the buttons to log your achievements for the active competition rules.</CardDescription>
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

          {error && <p className="text-destructive mb-4">{error}</p>}

          {/* Achievements Grid */}
          {isLoading ? (
            // Loading Skeletons for Cards
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="shadow-md overflow-hidden">
                  <CardContent className="p-0 flex">
                    <div className="flex-grow p-4 pr-2 space-y-2">
                      <div className="flex items-start gap-2 mb-1">
                         <Skeleton className="h-6 w-6 rounded-full" />
                         <Skeleton className="h-4 w-3/4 mt-1" />
                      </div>
                      <Skeleton className="h-3 w-1/2 ml-8" />
                      <Skeleton className="h-5 w-1/4 ml-8" />
                       <Skeleton className="h-3 w-1/3 ml-8" />
                    </div>
                    <div className="flex flex-col w-[70px] border-l">
                      <Skeleton className="h-1/2 w-full" />
                      <Skeleton className="h-1/2 w-full border-t" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !canLog && !error && !isLoadingUser && !agentPodId ? (
                // Specific message if not assigned to a pod
                <p className="text-muted-foreground text-center py-6">You are not assigned to a pod. Please contact your manager.</p>
          ) : !canLog && !error ? (
             <p className="text-muted-foreground text-center py-6">
                {competitionRules.length === 0 ? "No active competition or rules found for your pod on this date." : "Loading data..."}
             </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {competitionRules.map((rule) => (
                 // Ensure rule.id is valid before rendering card
                rule.id ? (
                  <AchievementCard
                    key={rule.id}
                    rule={rule}
                    currentValue={achievementInputs[rule.id]?.value ?? 0}
                    isSaving={isSaving[rule.id] || false}
                    onIncrement={() => handleValueChange(rule.id!, 1)}
                    onDecrement={() => handleValueChange(rule.id!, -1)}
                  />
                ) : null // Skip rendering card if rule.id is invalid
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
