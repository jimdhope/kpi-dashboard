
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { CheckSquare } from 'lucide-react';
import { collection, query, where, Timestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { CompetitionWithRules } from '@/app/(agent)/agent/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';

interface TodaysAchievementsWidgetProps {
    currentUser: AppUser | null;
    activeCompetitionId: string | null;
}

interface AchievementSummary {
    ruleName: string;
    points: number;
}

export function TodaysAchievementsWidget({ currentUser, activeCompetitionId }: TodaysAchievementsWidgetProps) {
    const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!currentUser?.id || !activeCompetitionId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const logsQuery = query(
            collection(db, 'dailyAchievements'),
            where('agentId', '==', currentUser.id),
            where('competitionId', '==', activeCompetitionId),
            where('date', '>=', todayStart),
            where('date', '<=', todayEnd)
        );

        const unsubscribe = onSnapshot(logsQuery, (snap) => {
            setDailyLogs(snap.docs.map(d => d.data() as DailyAchievementLog));
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching today's achievements:", err);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, activeCompetitionId]);

    const { totalPoints, achievements } = useMemo(() => {
        let total = 0;
        const summary: AchievementSummary[] = [];

        dailyLogs.forEach(log => {
            if (log.status !== 'absent') {
                const points = log.points || 0;
                total += points;
                summary.push({ ruleName: log.ruleName, points: points });
            }
        });

        return { totalPoints: total, achievements: summary };
    }, [dailyLogs]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    Today's Score
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalPoints.toLocaleString()} pts</div>
                <p className="text-xs text-muted-foreground">Your total points earned today.</p>
                {achievements.length > 0 && (
                    <div className="mt-3 text-sm space-y-1">
                        {achievements.map((ach, index) => (
                            <div key={index} className="flex justify-between">
                                <span>{ach.ruleName}</span>
                                <span>{ach.points.toLocaleString()} pts</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
