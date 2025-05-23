
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, AlertCircle, Target, Filter } from 'lucide-react'; // Added Filter icon
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

// Define the structure for daily targets
export interface DailyTargetData {
    // ruleId -> { mon: number, tue: number, ... }
    [ruleId: string]: {
        [dayOfWeek: string]: number | null | undefined; // e.g., mon, tue, wed... Use null or undefined if no target
    };
}

const daysOfWeek = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; // Consistent order

const POD_TARGETS_COMPETITION_KEY = 'podTargetsPage_selectedCompetitionId';
const POD_TARGETS_POD_KEY = 'podTargetsPage_selectedPodId';

export default function AdminPodTargetsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [competitionRules, setCompetitionRules] = useState<RuleFormData[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData>({});
  const [isLoading, setIsLoading] = useState(true); // For initial competitions/pods load
  const [isLoadingData, setIsLoadingData] = useState(false); // For rules/targets load
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load saved filters from localStorage on mount
  React.useEffect(() => {
    const savedCompetitionId = localStorage.getItem(POD_TARGETS_COMPETITION_KEY);
    if (savedCompetitionId) {
        setSelectedCompetitionId(savedCompetitionId);
    }
    const savedPodId = localStorage.getItem(POD_TARGETS_POD_KEY);
    // This will be re-evaluated when competitions/pods load
    if (savedPodId) {
        setSelectedPodId(savedPodId);
    }
  }, []);


  // 1. Fetch Competitions and Pods
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        // Fetch Competitions
        const compQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
        unsubscribes.push(onSnapshot(compQuery, (snapshot) => {
            if (!isMounted) return;
            setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
        }, (err) => { if(isMounted) setError("Failed to load competitions."); }));

        // Fetch Pods
        const podQuery = query(collection(db, 'pods'), orderBy('name'));
        unsubscribes.push(onSnapshot(podQuery, (snapshot) => {
             if (!isMounted) return;
             setPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
             setIsLoading(false); // Mark loading complete after pods
        }, (err) => { if(isMounted) { setError("Failed to load pods."); setIsLoading(false); } }));

      } catch (err) {
        if(isMounted){
            console.error("Error fetching initial data:", err);
            setError("Failed to load necessary data.");
            setIsLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
         isMounted = false;
         unsubscribes.forEach(unsub => unsub());
     };
  }, []);

  // 2. Fetch Rules and Existing Targets when Competition/Pod selection changes
  useEffect(() => {
    if (!selectedCompetitionId || !selectedPodId) {
      setCompetitionRules([]);
      setDailyTargets({});
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setError(null);
    setCompetitionRules([]);
    setDailyTargets({});

    const fetchData = async () => {
      try {
        // Fetch Competition Rules
        const compDocRef = doc(db, 'competitions', selectedCompetitionId);
        const compDocSnap = await getDoc(compDocRef);
        if (compDocSnap.exists()) {
          setCompetitionRules((compDocSnap.data() as Competition).rules || []);
        } else {
           throw new Error("Selected competition not found.");
        }

        // Fetch Existing Daily Targets
        const targetsDocId = `${selectedCompetitionId}_${selectedPodId}`;
        const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
        const targetsDocSnap = await getDoc(targetsDocRef);
        if (targetsDocSnap.exists()) {
          setDailyTargets(targetsDocSnap.data() as DailyTargetData);
        } else {
          setDailyTargets({}); // No existing targets
        }

      } catch (err: any) {
        console.error("Error loading rules/targets:", err);
        setError(err.message || "Failed to load competition rules or targets.");
        toast({ variant: "destructive", title: "Loading Error", description: err.message });
        setCompetitionRules([]);
        setDailyTargets({});
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();

  }, [selectedCompetitionId, selectedPodId, toast]);

  // Handle Input Change
  const handleTargetChange = (ruleId: string, day: string, value: string) => {
    const numericValue = value === '' ? null : parseInt(value, 10); // Use null for empty
    if (value !== '' && (isNaN(numericValue!) || numericValue! < 0)) return; // Allow empty or non-negative integers

    setDailyTargets(prev => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || {}),
        [day]: numericValue,
      },
    }));
  };

  // Handle Save
  const handleSaveChanges = async () => {
    if (!selectedCompetitionId || !selectedPodId) {
      toast({ variant: "destructive", title: "Selection Missing", description: "Please select a competition and a pod." });
      return;
    }

    setIsSaving(true);
    try {
      const targetsDocId = `${selectedCompetitionId}_${selectedPodId}`;
      const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);

       // Clean up data: Remove rules with no targets set for any day
        const cleanedTargets: DailyTargetData = {};
        for (const ruleId in dailyTargets) {
            const days = dailyTargets[ruleId];
            const hasTarget = Object.values(days).some(val => val !== null && val !== undefined && val >= 0);
            if (hasTarget) {
                 cleanedTargets[ruleId] = {};
                 for (const day in days) {
                      const val = days[day];
                      if (val !== null && val !== undefined && val >= 0) {
                         cleanedTargets[ruleId][day] = val;
                      } else {
                         // Ensure null/undefined are removed, don't store them
                      }
                 }
                 // If after cleaning, a rule has no days left, remove the rule entry
                  if (Object.keys(cleanedTargets[ruleId]).length === 0) {
                     delete cleanedTargets[ruleId];
                 }
            }
        }


      await setDoc(targetsDocRef, cleanedTargets); // Overwrite with cleaned data

      toast({ title: "Targets Saved", description: "Daily pod targets have been updated." });
    } catch (err: any) {
      console.error("Error saving targets:", err);
      toast({ variant: "destructive", title: "Save Error", description: "Could not save daily targets." });
    } finally {
      setIsSaving(false);
    }
  };

  // Memoize available pods based on selected competition
    const availablePods = useMemo(() => {
        if (!selectedCompetitionId) return [];
        const competition = competitions.find(c => c.id === selectedCompetitionId);
        if (!competition || !competition.podIds) return [];
        return pods.filter(pod => competition.podIds.includes(pod.id));
    }, [competitions, pods, selectedCompetitionId]);


  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Competition Select */}
            <div className="grid gap-2">
              <Label htmlFor="competition-select">Competition</Label>
              <Select
                  onValueChange={(value) => {
                      setSelectedCompetitionId(value);
                      localStorage.setItem(POD_TARGETS_COMPETITION_KEY, value);
                      setSelectedPodId(''); // Reset pod on comp change
                      localStorage.removeItem(POD_TARGETS_POD_KEY);
                  }}
                  value={selectedCompetitionId}
                  disabled={isLoading || isSaving}
              >
                <SelectTrigger id="competition-select">
                  <SelectValue placeholder="Select a competition" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.length === 0 && !isLoading && <SelectItem value="-" disabled>No competitions found</SelectItem>}
                  {isLoading && <SelectItem value="-" disabled>Loading...</SelectItem>}
                  {competitions.map(comp => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name} ({comp.startDate ? format(comp.startDate.toDate(), 'PP') : 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pod Select (Filtered by Competition) */}
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select
                  onValueChange={(value) => {
                      setSelectedPodId(value);
                      localStorage.setItem(POD_TARGETS_POD_KEY, value);
                  }}
                  value={selectedPodId}
                  disabled={isLoading || isSaving || !selectedCompetitionId || availablePods.length === 0}
              >
                <SelectTrigger id="pod-select">
                  <SelectValue placeholder={!selectedCompetitionId ? "Select competition first" : (availablePods.length === 0 ? "No pods in competition" : "Select a pod")} />
                </SelectTrigger>
                <SelectContent>
                  {!selectedCompetitionId ? (
                    <SelectItem value="-" disabled>Select competition first</SelectItem>
                  ) : availablePods.length === 0 ? (
                     <SelectItem value="-" disabled>No pods participate</SelectItem>
                  ) : (
                    availablePods.map(pod => (
                      <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle>Manage Pod Daily Targets</CardTitle>
          <CardDescription>Set daily achievement targets for each rule within the selected competition and pod.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(100vh-350px)]">
          {error && <p className="text-destructive text-center mb-4">{error}</p>}

          {/* Targets Table */}
          {selectedCompetitionId && selectedPodId ? (
            isLoadingData ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : competitionRules.length === 0 ? (
               <p className="text-center text-muted-foreground mt-6">No rules found for the selected competition.</p>
            ) : (
              <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="min-w-[200px]">Rule</TableHead>
                          {daysOfWeek.map(day => (
                            <TableHead key={day} className="w-[80px] text-center capitalize">{day}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {competitionRules.map((rule) => (
                           rule.id && ( // Ensure rule has an ID
                                <TableRow key={rule.id}>
                                <TableCell className="font-medium">
                                    {rule.emoji || '❓'} {rule.name}
                                </TableCell>
                                {daysOfWeek.map(day => (
                                    <TableCell key={`${rule.id}-${day}`} className="text-center">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="-"
                                        className="h-8 w-16 text-center mx-auto" // Centered input
                                        value={dailyTargets[rule.id!]?.[day] ?? ''} // Use ?? '' for empty display
                                        onChange={(e) => handleTargetChange(rule.id!, day, e.target.value)}
                                        disabled={isSaving}
                                    />
                                    </TableCell>
                                ))}
                                </TableRow>
                           )
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end">
                     <Button onClick={handleSaveChanges} disabled={isSaving}>
                       {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       Save Daily Targets
                     </Button>
                  </div>
              </div>
            )
          ) : (
             !isLoading && <p className="text-center text-muted-foreground mt-6">Select a competition and pod to manage daily targets.</p>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

    
