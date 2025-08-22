
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, Unsubscribe, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Leaderboard } from '@/components/leaderboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface PodLeaderboardWidgetProps {
    currentUser: AppUser | null;
}

const POD_LEADERBOARD_COMP_KEY = 'podLeaderboard_selectedCompId';

export function PodLeaderboardWidget({ currentUser }: PodLeaderboardWidgetProps) {
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
    const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);
    const [allPods, setAllPods] = useState<Pod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);

    // Fetch all competitions the user's pod is part of
    useEffect(() => {
        if (!currentUser?.podId) return;
        const compQuery = query(
            collection(db, 'competitions'),
            where('podIds', 'array-contains', currentUser.podId),
            orderBy('startDate', 'desc')
        );
        const unsubscribe = onSnapshot(compQuery, (snapshot) => {
            const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
            setAllCompetitions(fetchedComps);
            if (!selectedCompetitionId && fetchedComps.length > 0) {
                const savedCompId = localStorage.getItem(POD_LEADERBOARD_COMP_KEY);
                 if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                    setSelectedCompetitionId(savedCompId);
                } else {
                    setSelectedCompetitionId(fetchedComps[0].id);
                }
            }
        });
        return () => unsubscribe();
    }, [currentUser?.podId, selectedCompetitionId]);

    // Fetch all pods and all logs for the selected competition
    useEffect(() => {
        if (!selectedCompetitionId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const unsubscribes: Unsubscribe[] = [];

        // Fetch all pods (for names and avatars)
        const podsQuery = query(collection(db, 'pods'));
        unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
            setAllPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
        }));

        // Fetch all logs for the entire competition
        const logsQuery = query(collection(db, 'dailyAchievements'), where('competitionId', '==', selectedCompetitionId));
        unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
            setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
            setIsLoading(false);
        }));

        return () => unsubscribes.forEach(unsub => unsub());
    }, [selectedCompetitionId]);


    const podLeaderboard = useMemo(() => {
        const competition = allCompetitions.find(c => c.id === selectedCompetitionId);
        if (isLoading || !competition || allPods.length === 0) {
            return [];
        }

        const participatingPods = allPods.filter(p => competition.podIds.includes(p.id));

        const podScores = participatingPods.reduce((acc, pod) => {
            acc[pod.id] = competitionLogs
                .filter(log => log.podId === pod.id)
                .reduce((sum, log) => sum + (log.points || 0), 0);
            return acc;
        }, {} as Record<string, number>);

        return participatingPods.map(pod => ({
            id: pod.id!,
            name: pod.name,
            score: podScores[pod.id!] || 0,
            avatarInitials: pod.logoInitials,
            avatarBgColor: pod.logoBgColor,
            isUser: pod.id === currentUser?.podId,
        }));
    }, [isLoading, competitionLogs, allPods, selectedCompetitionId, allCompetitions, currentUser?.podId]);

    const handleCompetitionChange = (value: string) => {
        setSelectedCompetitionId(value);
        localStorage.setItem(POD_LEADERBOARD_COMP_KEY, value);
    };

    const selectedCompetition = allCompetitions.find(c => c.id === selectedCompetitionId);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Pod Leaderboard
                    </div>
                     <Select
                        value={selectedCompetitionId}
                        onValueChange={handleCompetitionChange}
                        disabled={allCompetitions.length === 0}
                    >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Select Competition" />
                        </SelectTrigger>
                        <SelectContent>
                            {allCompetitions.map(comp => (
                                <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardTitle>
                 {selectedCompetition && <CardDescription>Overall pod ranking for: {selectedCompetition.name}</CardDescription>}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : (
                    <Leaderboard entries={podLeaderboard} />
                )}
            </CardContent>
        </Card>
    );
}
