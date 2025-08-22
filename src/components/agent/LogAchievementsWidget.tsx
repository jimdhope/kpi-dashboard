
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AchievementCard } from '@/components/achievement-card';
import type { RuleFormData } from '@/models/types';
import type { AppUser } from '@/services/user';
import type { DailyAchievementLog, DailyTaskLog } from '@/app/(admin)/admin/log-achievements/page';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, deleteDoc, serverTimestamp, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay } from 'date-fns';

interface LogAchievementsWidgetProps {
    currentUser: AppUser | null;
}

interface CompetitionWithId extends Competition {
    id: string;
}

// Debounce utility function
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export function LogAchievementsWidget({ currentUser }: LogAchievementsWidgetProps) {
    const { toast } = useToast();
    const [rules, setRules] = useState<RuleFormData[]>([]);
    const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);
    const [achievementInputs, setAchievementInputs] = useState<Record<string, { value: number; logId?: string }>>({});
    const [taskInputs, setTaskInputs] = useState<Record<string, { checked: boolean; logId?: string }>>({});
    const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

    const agentPodId = currentUser?.podId;

    // Effect to find the active competition and its rules
    useEffect(() => {
        if (!agentPodId) return;
        const today = new Date();
        const compQuery = query(
            collection(db, 'competitions'),
            where('podIds', 'array-contains', agentPodId),
            orderBy('startDate', 'desc')
        );

        const unsubscribe = onSnapshot(compQuery, (snapshot) => {
            let foundCompetition: CompetitionWithId | null = null;
            for (const docSnap of snapshot.docs) {
                const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithId;
                if (comp.startDate.toDate() <= today && comp.endDate.toDate() >= today) {
                    foundCompetition = comp;
                    break;
                }
            }
            setActiveCompetitionId(foundCompetition?.id || null);
            setRules(foundCompetition?.rules || []);
        });

        return () => unsubscribe();
    }, [agentPodId]);


    // Effect to populate initial state from Firestore based on active competition
    useEffect(() => {
        if (!currentUser?.id || !agentPodId || !activeCompetitionId) return;

        const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
        
        const achievementsQuery = query(
            collection(db, 'dailyAchievements'),
            where('agentId', '==', currentUser.id),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetitionId)
        );
        
        const taskLogsQuery = query(
            collection(db, 'dailyTaskLogs'),
            where('agentId', '==', currentUser.id),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetitionId)
        );

        const unsubAchievements = onSnapshot(achievementsQuery, (snapshot) => {
            const initialInputs: typeof achievementInputs = {};
            snapshot.forEach(doc => {
                const log = doc.data() as DailyAchievementLog;
                initialInputs[log.ruleId] = { value: log.value, logId: doc.id };
            });
            setAchievementInputs(initialInputs);
        });

         const unsubTasks = onSnapshot(taskLogsQuery, (snapshot) => {
            const initialTaskInputs: typeof taskInputs = {};
            snapshot.forEach(doc => {
                const log = doc.data() as DailyTaskLog;
                initialTaskInputs[log.taskId] = { checked: true, logId: doc.id };
            });
             setTaskInputs(initialTaskInputs);
        });

        return () => {
            unsubAchievements();
            unsubTasks();
        };

    }, [currentUser, agentPodId, activeCompetitionId]);

    const handleSaveAchievement = useCallback(async (ruleId: string, value: number) => {
         if (!agentPodId || !currentUser?.id || !activeCompetitionId) return;
         const rule = rules.find(r => r.id === ruleId);
         if (!rule) return;

         setIsSaving(prev => ({...prev, [ruleId]: true }));
         const logId = achievementInputs[ruleId]?.logId;
         const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
         
         try {
             const points = (rule.points || 0) * value;
             if (logId) { // Update or delete existing
                 if (value > 0) {
                     await setDoc(doc(db, 'dailyAchievements', logId), { value, points, loggedAt: serverTimestamp() }, { merge: true });
                 } else {
                     await deleteDoc(doc(db, 'dailyAchievements', logId));
                     setAchievementInputs(prev => { const newState = {...prev}; delete newState[ruleId]; return newState; });
                 }
             } else if (value > 0) { // Create new
                 const newDocRef = await addDoc(collection(db, 'dailyAchievements'), {
                     agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetitionId,
                     ruleId, ruleName: rule.name, date: dateTimestamp, value, points,
                     loggedAt: serverTimestamp(), loggedBy: currentUser.uid
                 });
                 setAchievementInputs(prev => ({...prev, [ruleId]: { ...prev[ruleId], logId: newDocRef.id }}));
             }
         } catch (e) {
             toast({ variant: 'destructive', title: 'Save Failed' });
         } finally {
             setIsSaving(prev => ({...prev, [ruleId]: false }));
         }
    }, [agentPodId, currentUser, activeCompetitionId, rules, achievementInputs, toast]);

    const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement]);

    const handleValueChange = (ruleId: string, change: number) => {
        const currentValue = achievementInputs[ruleId]?.value ?? 0;
        const newValue = Math.max(0, currentValue + change);
        setAchievementInputs(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], value: newValue } }));
        debouncedSave(ruleId, newValue);
    };

    const handleTaskChange = useCallback(async (ruleId: string, checked: boolean) => {
        if (!agentPodId || !currentUser?.id || !activeCompetitionId) return;
        setIsSaving(prev => ({...prev, [ruleId]: true }));
        const logId = taskInputs[ruleId]?.logId;
        
        try {
            if (checked) {
                if (!logId) {
                     const newDocRef = await addDoc(collection(db, 'dailyTaskLogs'), {
                         agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetitionId,
                         taskId: ruleId, date: Timestamp.fromDate(startOfDay(new Date())),
                         loggedAt: serverTimestamp(), loggedBy: currentUser.uid
                     });
                     setTaskInputs(prev => ({...prev, [ruleId]: { ...prev[ruleId], logId: newDocRef.id, checked: true }}));
                }
            } else {
                 if (logId) {
                     await deleteDoc(doc(db, 'dailyTaskLogs', logId));
                     setTaskInputs(prev => { const newState = {...prev}; delete newState[ruleId]; return newState; });
                 }
            }
        } catch (e) {
             toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSaving(prev => ({...prev, [ruleId]: false }));
        }
    }, [agentPodId, currentUser, activeCompetitionId, taskInputs, toast]);


    const numericRules = rules.filter(r => r.type === 'numeric');
    const taskRules = rules.filter(r => r.type === 'checkbox');

    if (!activeCompetitionId) return null; // Don't render if no active competition
    if (numericRules.length === 0 && taskRules.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary"/> Log Today's Progress</CardTitle>
                <CardDescription>Your changes are saved automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {numericRules.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                        {numericRules.map(rule => (
                            <div key={rule.id} className="flex-auto min-w-[200px]">
                                <AchievementCard
                                    rule={rule}
                                    currentValue={achievementInputs[rule.id!]?.value ?? 0}
                                    isSaving={isSaving[rule.id!] || false}
                                    onIncrement={() => handleValueChange(rule.id!, 1)}
                                    onDecrement={() => handleValueChange(rule.id!, -1)}
                                />
                            </div>
                        ))}
                    </div>
                )}
                {taskRules.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                         <Label className="text-sm font-medium">Daily Tasks</Label>
                        {taskRules.map(rule => (
                            <div key={rule.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`task-${rule.id}`}
                                    checked={taskInputs[rule.id!]?.checked || false}
                                    onCheckedChange={(checked) => handleTaskChange(rule.id!, !!checked)}
                                    disabled={isSaving[rule.id!] || false}
                                />
                                <label htmlFor={`task-${rule.id}`} className="text-sm font-normal">
                                    {rule.emoji} {rule.name}
                                </label>
                                {isSaving[rule.id!] && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

