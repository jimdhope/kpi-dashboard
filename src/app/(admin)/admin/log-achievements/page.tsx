
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
  limit, // Import limit
  Unsubscribe, // Import Unsubscribe
  onSnapshot, // Import onSnapshot
  deleteDoc, // Import deleteDoc
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase'; // Import auth as well
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label'; // Import Label
import { CalendarIcon, Loader2, AlertCircle } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Interface for the data stored in Firestore
export interface DailyAchievementLog {
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
  loggedBy?: string | null; // UID of admin who logged it
}

// Interface for managing state within the component
interface AchievementInputState {
  [agentId: string]: {
    [ruleId: string]: {
      value: string; // Use string for input control
      existingLogId?: string; // To know if we update or add
    };
  };
}

export default function AdminLogAchievementsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date())); // Default to today
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AchievementInputState>({});
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({}); // Track saving per agent/rule
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null); // Store competition ID

  // Get current user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUserUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);


  // Fetch Pods
  useEffect(() => {
    setIsLoadingPods(true);
    const podsRef = collection(db, 'pods');
    const q = query(podsRef, orderBy('name'));
    // Use onSnapshot for real-time updates if needed, otherwise getDocs is fine
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

    return () => unsubscribe(); // Cleanup listener
  }, [toast]);

  // Fetch Agents, Competition Rules, and Existing Achievements when Pod or Date changes
  useEffect(() => {
    if (!selectedPodId) {
      setAgents([]);
      setCompetitionRules([]);
      setAchievementInputs({});
      setActiveCompetitionId(null); // Reset active competition
      // Set loading states to false if no pod is selected
      setIsLoadingAgents(false);
      setIsLoadingRules(false);
      setIsLoadingAchievements(false);
      return;
    }

    const fetchPodData = async () => {
      setIsLoadingAgents(true);
      setIsLoadingRules(true);
      setIsLoadingAchievements(true);
      setError(null);
      setAgents([]);
      setCompetitionRules([]);
      setAchievementInputs({}); // Reset inputs
      setActiveCompetitionId(null); // Reset active competition

      try {
        // 1. Fetch Agents for the selected Pod (only those with 'agent' role)
        const usersRef = collection(db, 'users');
        const agentsQuery = query(
            usersRef,
            where('podId', '==', selectedPodId),
            where('roles', 'array-contains', 'agent'), // Ensure they have the agent role
            orderBy('name')
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const fetchedAgents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAgents(fetchedAgents);
        setIsLoadingAgents(false);

         if (fetchedAgents.length === 0) {
            toast({ variant: "default", title: "No Agents", description: "No users with the 'agent' role found in this pod." });
             setIsLoadingRules(false); // Stop loading rules/achievements if no agents
             setIsLoadingAchievements(false);
             setActiveCompetitionId(null); // Ensure competition is cleared
             return;
         }

        // 2. Find a Competition active on the *selected date* involving this pod
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
        // Query to find ANY competition involving the pod, active on the date.
        const competitionQuery = query(
          competitionsRef,
          where('podIds', 'array-contains', selectedPodId), // Check if pod is in the array
          // Remove date constraints to allow backdating
          // where('startDate', '<=', dateTimestamp),
          orderBy('startDate', 'desc') // Get the most recent starting first
          // Filter by end date client-side is no longer needed here, but might be useful elsewhere
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let competitionForDate: (Competition & { id: string }) | null = null;

        // Find the competition that BRACKETS the selected date (most recent one if multiple overlap)
        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as Competition & { id: string };
            const startDate = comp.startDate instanceof Timestamp ? comp.startDate.toDate() : null;
            const endDate = comp.endDate instanceof Timestamp ? comp.endDate.toDate() : null;

            if (startDate && endDate && selectedDate >= startDate && selectedDate <= endDate) {
                 competitionForDate = comp;
                 console.log(`Found competition "${competitionForDate.name}" that includes ${selectedDate.toLocaleDateString()}`);
                break; // Found the most relevant competition for the selected date
            }
        }


        if (competitionForDate) {
            setActiveCompetitionId(competitionForDate.id); // Store the active ID
            setCompetitionRules(competitionForDate.rules || []);
        } else {
          setActiveCompetitionId(null); // No competition found for this date
          setCompetitionRules([]); // No competition, no rules
           toast({ variant: "default", title: "No Competition Found", description: `No competition includes the selected date: ${selectedDate.toLocaleDateString()}.` });
        }
        setIsLoadingRules(false);

        // 3. Fetch Existing Achievements for the Pod and Date (if agents and competition exist)
        if (competitionForDate && fetchedAgents.length > 0) {
           const achievementsRef = collection(db, 'dailyAchievements');
            const achievementsQuery = query(
                achievementsRef,
                where('podId', '==', selectedPodId),
                where('date', '==', dateTimestamp),
                where('competitionId', '==', competitionForDate.id) // Ensure it's for the correct competition
             );
             const achievementsSnapshot = await getDocs(achievementsQuery);
             const existingAchievements = achievementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));

            // 4. Initialize Input State
            const initialInputs: AchievementInputState = {};
            fetchedAgents.forEach(agent => {
                 // Ensure agent.id is not undefined before using it as a key
                 if (!agent.id) return;
                initialInputs[agent.id] = {};
                (competitionForDate?.rules || []).forEach(rule => {
                     // Ensure rule.id is not undefined
                     if (!rule.id) return;
                   const existingLog = existingAchievements.find(log => log.agentId === agent.id && log.ruleId === rule.id);
                    initialInputs[agent.id!][rule.id] = {
                        value: existingLog ? String(existingLog.value) : '',
                        existingLogId: existingLog?.id,
                    };
                });
             });
            setAchievementInputs(initialInputs);
         } else {
            // No competition or no agents, clear inputs
            setAchievementInputs({});
         }


      } catch (err) {
        console.error("Error fetching pod data:", err);
        setError("Failed to load data for the selected pod/date.");
        toast({ variant: "destructive", title: "Error", description: "Could not load agent or competition data." });
        setAgents([]);
        setCompetitionRules([]);
        setAchievementInputs({});
        setActiveCompetitionId(null);
      } finally {
        setIsLoadingAgents(false); // Ensure all loading states are false
        setIsLoadingRules(false);
        setIsLoadingAchievements(false);
      }
    };

    fetchPodData();
  }, [selectedPodId, selectedDate, toast]);

  const handleInputChange = (agentId: string, ruleId: string, value: string) => {
    setAchievementInputs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [ruleId]: {
          ...prev[agentId]?.[ruleId], // Preserve existingLogId
          value: value,
        },
      },
    }));
     // Trigger save automatically on change after a short delay (debounced)
     debouncedSave(agentId, ruleId, value);
  };

   // Debounce function
   const debounce = (func: Function, delay: number) => {
       let timeoutId: NodeJS.Timeout;
       return (...args: any[]) => {
           clearTimeout(timeoutId);
           timeoutId = setTimeout(() => {
               func.apply(null, args);
           }, delay);
       };
   };

    const handleSaveAchievement = async (agentId: string, ruleId: string, valueStr: string | undefined) => {
    if (!selectedPodId || !currentUserUid || !activeCompetitionId) { // Check activeCompetitionId state
      console.error("Pod, user, or active competition information missing for auto-save.");
      return;
    }

    const rule = competitionRules.find(r => r.id === ruleId);
    const agentInput = achievementInputs[agentId]?.[ruleId];

    if (!rule || agentInput === undefined) {
       console.error("Rule or input data not found for auto-save.", rule, agentInput);
      return;
    }

     // Use the value passed to the function (from input change)
    const value = parseInt(valueStr || '0', 10);

     if (isNaN(value) || value < 0) {
       // Maybe a subtle visual cue instead of toast for auto-save errors
       console.warn("Invalid input value for auto-save:", valueStr);
       // Optionally reset the input visually or show a small error indicator
       // form.setError(...) or similar if using react-hook-form, otherwise manage state
       return;
     }

     const savingKey = `${agentId}-${ruleId}`;
     setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    try {
       const points = rule.points * value;
       const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate)); // Use the selected date

       const logEntry: Omit<DailyAchievementLog, 'id'> = {
         agentId: agentId,
         podId: selectedPodId,
         competitionId: activeCompetitionId, // Use the stored active competition ID
         ruleId: rule.id!,
         ruleName: rule.name,
         date: dateTimestamp,
         value: value,
         points: points,
         loggedAt: serverTimestamp(),
         loggedBy: currentUserUid, // Logged by Admin/Manager
       };

       const achievementsRef = collection(db, 'dailyAchievements');
       let docRef;

       if (agentInput.existingLogId) {
         docRef = doc(achievementsRef, agentInput.existingLogId);
         // If value is 0, delete the log instead of updating
         if (value === 0) {
             await deleteDoc(docRef);
             console.log(`Achievement deleted for ${rule.name} (value set to 0)`);
             // Update state to remove existingLogId immediately
             setAchievementInputs(prev => {
                 const newState = { ...prev };
                  if (newState[agentId]?.[ruleId]) {
                     newState[agentId][ruleId].existingLogId = undefined;
                 }
                 return newState;
             });
         } else {
             await setDoc(docRef, logEntry, { merge: true });
             console.log(`Achievement updated for ${rule.name} to ${value}`);
         }
       } else if (value > 0) { // Only create if value > 0
         const addedDoc = await addDoc(achievementsRef, logEntry);
         // Update state with the new ID immediately
         setAchievementInputs(prev => {
             const newState = { ...prev };
              if (newState[agentId] && newState[agentId][ruleId]) {
                 newState[agentId][ruleId].existingLogId = addedDoc.id;
             } else if (newState[agentId]) {
                 newState[agentId][ruleId] = { value: String(value), existingLogId: addedDoc.id };
             } else {
                  newState[agentId] = { [ruleId]: { value: String(value), existingLogId: addedDoc.id } };
             }
             return newState;
         });
          console.log(`Achievement logged for ${rule.name} with value ${value}`); // Log instead of toast
       } else {
          // Value is 0, no existing log, do nothing silently
           // console.log(`Log skipped for ${rule.name} (value 0)`);
       }

    } catch (err) {
      console.error("Error auto-saving achievement:", err);
      // Consider a less intrusive error indicator than toast for auto-save
       toast({ variant: "destructive", title: "Auto-Save Failed", description: `Could not save ${rule.name} for agent.` });
    } finally {
       setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

   // Create the debounced save function
   const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), // Debounce for 1 second
     // Dependencies: recreate debounce function if these change
      [selectedPodId, currentUserUid, competitionRules, achievementInputs, selectedDate, toast, activeCompetitionId] // Added activeCompetitionId
  );


  const isLoading = isLoadingPods || isLoadingAgents || isLoadingRules || isLoadingAchievements;
   // Check if any specific cell is saving
  const isAnyCellSaving = (agentId: string): boolean => {
      return competitionRules.some(rule => rule.id && isSaving[`${agentId}-${rule.id}`]);
  }
  const canLog = selectedPodId && agents.length > 0 && competitionRules.length > 0 && activeCompetitionId; // Check if a competition was found

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Log Daily Achievements</CardTitle>
          <CardDescription>Select a pod and date, then enter the achievements for each agent based on the active competition rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="flex flex-wrap gap-4 mb-6 items-end">
            {/* Pod Select */}
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select onValueChange={setSelectedPodId} value={selectedPodId} disabled={isLoadingPods}>
                <SelectTrigger id="pod-select" className="w-[200px]">
                  <SelectValue placeholder={isLoadingPods ? "Loading..." : "Select Pod"} />
                </SelectTrigger>
                <SelectContent>
                  {/* Removed the placeholder SelectItem */}
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

          {/* Achievements Table */}
           {!selectedPodId ? (
             <p className="text-muted-foreground text-center">Please select a pod.</p>
           ) : isLoading ? (
              // Loading Skeletons
              <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 3 }).map((_, i) => (
                     <div key={i} className="flex gap-4 items-center border p-4 rounded">
                        <Skeleton className="h-6 w-32" /> {/* Agent Name */}
                         <div className="flex-1 grid grid-cols-3 gap-4"> {/* Adjust cols based on typical rule count */}
                           <Skeleton className="h-8 w-full" />
                           <Skeleton className="h-8 w-full" />
                           <Skeleton className="h-8 w-full" />
                        </div>
                     </div>
                  ))}
              </div>
           ) : !canLog && !error ? (
               <p className="text-muted-foreground text-center py-6">
                  {agents.length === 0 ? "No agents found in this pod." : activeCompetitionId === null ? `No competition found for this pod active on ${selectedDate.toLocaleDateString()}.` : "No competition rules found."}
               </p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>{/* Remove whitespace here */}
                  <TableHead className="w-[200px]">Agent</TableHead>
                  {competitionRules.map(rule => (
                    <TableHead key={rule.id}>
                       {/* Use emoji if it exists and is not empty, otherwise use fallback */}
                       {(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} {rule.name} <span className="text-xs text-muted-foreground">({rule.points} pts)</span>
                    </TableHead>
                  ))}
                  {/* Optional: Add a status column if needed */}
                   {/* <TableHead className="w-[100px] text-right">Status</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                   // Ensure agent.id is valid before rendering row
                   agent.id ? (
                    <TableRow key={agent.id}>{/* Remove whitespace here */}
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        {competitionRules.map(rule => (
                           // Ensure rule.id is valid before rendering cell
                          rule.id ? (
                            <TableCell key={rule.id}>
                                <div className="relative w-24"> {/* Adjust width as needed */}
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="Value"
                                        value={achievementInputs[agent.id!]?.[rule.id]?.value ?? ''}
                                        onChange={(e) => handleInputChange(agent.id!, rule.id!, e.target.value)}
                                        className="h-8 w-full pr-6" // Add padding for loader
                                        disabled={isSaving[`${agent.id}-${rule.id}`]} // Disable individual input when saving
                                        aria-label={`Achievement value for ${agent.name} - ${rule.name}`}
                                    />
                                    {isSaving[`${agent.id}-${rule.id}`] && (
                                         <Loader2 className="absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                     )}
                                </div>
                            </TableCell>
                           ) : null // Skip rendering cell if rule.id is invalid
                        ))}
                        {/* Optional Status Cell */}
                         {/*
                         <TableCell className="text-right">
                           {isAnyCellSaving(agent.id) && <Loader2 className="h-4 w-4 animate-spin inline-block text-muted-foreground"/>}
                         </TableCell>
                         */}
                    </TableRow>
                   ) : null // Skip rendering row if agent.id is invalid
                ))}
              </TableBody>
            </Table>
             )}
        </CardContent>
      </Card>

       {/* Display Existing Logs (Read-only view below input table - Optional) */}
       {/* Consider adding a separate component or view for browsing historical logs */}

    </div>
  );
}

