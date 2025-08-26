
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { CheckSquare } from 'lucide-react';
import { collection, query, where, Timestamp, onSnapshot, Unsubscribe, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { ReadOnlyAchievementCard } from '../read-only-achievement-card';
import type { RuleFormData } from '@/models/types';


interface ReadOnlyAchievementsWidgetProps {
    currentUser: AppUser | null;
}

interface CompetitionWithId extends Competition {
    id: string;
}

export function ReadOnlyAchievementsWidget({ currentUser }: ReadOnlyAchievementsWidgetProps) {
    const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
    const [activeCompetition, setActiveCompetition] = useState<CompetitionWithId | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Effect to find the active competition
    useEffect(() => {
        if (!currentUser?.podId) {
            setIsLoading(false);
            return;
        }
        const today = new Date();
        const compQuery = query(
            collection(db, 'competitions'),
            where('podIds', 'array-contains', currentUser.podId),
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
            setActiveCompetition(foundCompetition);
        });

        return () => unsubscribe();
    }, [currentUser?.podId]);

    // Effect to fetch logs once active competition is known
    useEffect(() => {
        if (!currentUser?.id || !activeCompetition?.id) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const logsQuery = query(
            collection(db, 'dailyAchievements'),
            where('agentId', '==', currentUser.id),
            where('competitionId', '==', activeCompetition.id),
            where('date', '>=', todayStart),
            where('date', '<=', todayEnd)
        );

        const unsubscribe = onSnapshot(logsQuery, (snap) => {
            const logs = snap.docs.map(d => d.data() as DailyAchievementLog);
            setDailyLogs(logs.filter(log => log.status !== 'absent')); // Filter out absent logs
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching today's achievements:", err);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, activeCompetition]);

    const rulesToDisplay = useMemo(() => {
        // Show all numeric rules from the competition, even if not logged yet.
        return activeCompetition?.rules.filter(r => r.type === 'numeric') || [];
    }, [activeCompetition]);

    const achievementsMap = useMemo(() => {
        const map = new Map<string, number>();
        dailyLogs.forEach(log => {
            map.set(log.ruleId, log.value);
        });
        return map;
    }, [dailyLogs]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                    <Skeleton className="h-24 w-48 flex-auto min-w-[200px]" />
                    <Skeleton className="h-24 w-48 flex-auto min-w-[200px]" />
                </CardContent>
            </Card>
        );
    }
    
    if (!activeCompetition || rulesToDisplay.length === 0) {
        return null; // Don't render the widget if there are no rules to show
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    Today's Achievements
                </CardTitle>
                <CardDescription>Your logged values for today's achievements.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-wrap gap-4">
                     {rulesToDisplay.map(rule => (
                        <div key={rule.id} className="flex-auto min-w-[200px]">
                            <ReadOnlyAchievementCard
                                rule={rule}
                                currentValue={achievementsMap.get(rule.id!) || 0}
                            />
                        </div>
                     ))}
                 </div>
            </CardContent>
        </Card>
    );
}
