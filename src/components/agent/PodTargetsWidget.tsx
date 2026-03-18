
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from '@/components/ui/skeleton';
import { Target } from 'lucide-react';
import { collection, query, where, Timestamp, doc, getDoc, onSnapshot, Unsubscribe, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay, getDay, endOfDay } from 'date-fns';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/models/types';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { cn } from '@/lib/utils';

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface PodTargetsWidgetProps {
  currentUser: AppUser | null;
}

interface PodTargetSummary {
    ruleId: string;
    ruleName: string;
    ruleEmoji: string;
    achieved: number;
    target: number | null;
    progress?: number;
}

interface CompetitionWithRules extends Competition {
    id: string;
}


export function PodTargetsWidget({ currentUser }: PodTargetsWidgetProps) {
    const [rules, setRules] = useState<RuleFormData[]>([]);
    const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
    const [dailyLogs, setDailyLogs] = useState<DailyAchievementLog[]>([]);
    const [podAgents, setPodAgents] = useState<AppUser[]>([]);
    const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const agentPodId = currentUser?.podId;

    // Effect to find the active competition
    useEffect(() => {
        if (!agentPodId) return;
        const today = new Date();
        const compQuery = query(
            collection(db, 'competitions'),
            where('podIds', 'array-contains', agentPodId),
            orderBy('startDate', 'desc')
        );

        const unsubscribe = onSnapshot(compQuery, (snapshot) => {
            let foundCompetition: CompetitionWithRules | null = null;
            for (const docSnap of snapshot.docs) {
                const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
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


    // Effect to fetch all data needed for the widget
    useEffect(() => {
        if (!agentPodId || !activeCompetitionId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const unsubscribes: Unsubscribe[] = [];

        // Fetch agents in the pod
        const agentsQuery = query(collection(db, 'users'), where('podId', '==', agentPodId), where('roles', 'array-contains', 'agent'));
        unsubscribes.push(onSnapshot(agentsQuery, (snap) => {
            setPodAgents(snap.docs.map(d => d.data() as AppUser));
        }));

        // Fetch daily targets
        const targetsDocId = `${activeCompetitionId}_${agentPodId}`;
        const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
        unsubscribes.push(onSnapshot(targetsDocRef, (snap) => {
            setDailyTargets(snap.exists() ? snap.data() as DailyTargetData : null);
        }));

        // Fetch today's logs for the pod
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const logsQuery = query(
            collection(db, 'dailyAchievements'),
            where('podId', '==', agentPodId),
            where('competitionId', '==', activeCompetitionId),
            where('date', '>=', todayStart),
            where('date', '<=', todayEnd)
        );
        unsubscribes.push(onSnapshot(logsQuery, (snap) => {
            setDailyLogs(snap.docs.map(d => d.data() as DailyAchievementLog));
            setIsLoading(false); // Mark loading as complete after the last fetch
        }));

        return () => unsubscribes.forEach(unsub => unsub());
    }, [agentPodId, activeCompetitionId]);

    const podTargetSummary = useMemo((): PodTargetSummary[] => {
        const numericRules = rules.filter(r => r.type === 'numeric');
        const dayOfWeek = daysOfWeek[getDay(new Date())];

        if (numericRules.length === 0 || !dailyTargets || podAgents.length === 0) {
            return [];
        }

        const absentAgentIds = new Set(dailyLogs.filter(log => log.status === 'absent').map(log => log.agentId));
        const activeAgentsCount = podAgents.filter(agent => !absentAgentIds.has(agent.id!)).length;
        
        if (activeAgentsCount === 0) {
            return [];
        }

        const podRuleTotalsToday: Record<string, number> = {};
        numericRules.forEach(rule => { if (rule.id) podRuleTotalsToday[rule.id] = 0; });

        dailyLogs.forEach(log => {
            if (log.ruleId && podRuleTotalsToday.hasOwnProperty(log.ruleId) && !absentAgentIds.has(log.agentId)) {
                podRuleTotalsToday[log.ruleId] += (log.value || 0);
            }
        });

        return numericRules.map(rule => {
            if (!rule.id) return null;
            const individualTarget = dailyTargets?.[rule.id]?.[dayOfWeek];
            if (individualTarget === undefined || individualTarget === null || individualTarget < 0) return null;

            const podTarget = individualTarget * activeAgentsCount;
            const achieved = podRuleTotalsToday[rule.id] || 0;
            const progress = podTarget > 0 ? Math.min(Math.round((achieved / podTarget) * 100), 100) : 0;

            return { ruleId: rule.id, ruleName: rule.name, ruleEmoji: rule.emoji || '❓', achieved, target: podTarget, progress };
        }).filter((s): s is PodTargetSummary => s !== null);

    }, [rules, dailyTargets, dailyLogs, podAgents]);


    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (podTargetSummary.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" /> Pod Targets Today
                    </CardTitle>
                    <CardDescription>Your pod's collective progress towards daily goals.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">No targets set for today.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" /> Pod Targets Today
                </CardTitle>
                <CardDescription>Your pod's collective progress towards daily goals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {podTargetSummary.map(summary => (
                    <div key={summary.ruleId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium truncate" title={summary.ruleName}>
                                {summary.ruleEmoji} {summary.ruleName}
                            </span>
                            <span className={cn("font-semibold", summary.progress !== undefined && summary.progress >= 100 ? "text-green-600" : "text-muted-foreground")}>
                                {summary.achieved.toLocaleString()} / {summary.target?.toLocaleString()}
                            </span>
                        </div>
                        <Progress value={summary.progress ?? 0} className="h-2" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
