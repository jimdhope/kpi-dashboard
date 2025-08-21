
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
  orderBy,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, AlertCircle, Filter, Swords, Trophy, Award } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { TeamBonusLog } from '@/app/(admin)/admin/log-achievements/page';


interface GameResult {
  userId: string | null;
  userThrow: 'rock' | 'paper' | 'scissors';
  result: 'win' | 'loss' | 'draw';
  timestamp: Timestamp;
}

interface Team {
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
}

interface CompetitionWithTeams extends Competition {
    teams?: Team[];
}

interface TeamStats {
    id: string;
    name: string;
    emoji?: string;
    wins: number;
    losses: number;
    draws: number;
    rank?: number;
}

const RPS_SCORES_POD_KEY = 'rpsScoresPage_selectedPodId';
const RPS_SCORES_COMP_KEY = 'rpsScoresPage_selectedCompetitionId';
const RPS_SCORES_DATE_KEY = 'rpsScoresPage_selectedDate';

export default function AdminRpsScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awardedPointsToday, setAwardedPointsToday] = useState(false);
  const { toast } = useToast();

   useEffect(() => {
    const savedPodId = localStorage.getItem(RPS_SCORES_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedCompId = localStorage.getItem(RPS_SCORES_COMP_KEY);
    if (savedCompId) setSelectedCompetitionId(savedCompId);
    const savedDate = localStorage.getItem(RPS_SCORES_DATE_KEY);
    if (savedDate) setSelectedDate(new Date(savedDate));
  }, []);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(RPS_SCORES_POD_KEY, podId);
  };
  const handleCompetitionChange = (compId: string) => {
    setSelectedCompetitionId(compId);
    localStorage.setItem(RPS_SCORES_COMP_KEY, compId);
    setSelectedPodId('');
  };
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
        setSelectedDate(startOfDay(date));
        localStorage.setItem(RPS_SCORES_DATE_KEY, date.toISOString());
    }
  };


   useEffect(() => {
    setIsLoadingBase(true);
    const unsubscribes: Unsubscribe[] = [];
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => setPods(snap.docs.map(d => ({id: d.id, ...d.data()} as Pod)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'competitions'), orderBy('startDate', 'desc')), (snap) => setCompetitions(snap.docs.map(d => ({id: d.id, ...d.data()} as Competition)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('name')), (snap) => {
        setUsers(snap.docs.map(d => ({id: d.id, ...d.data()} as AppUser)));
        setIsLoadingBase(false);
    }));
    return () => unsubscribes.forEach(unsub => unsub());
   }, []);

    const availablePods = useMemo(() => {
        if (!selectedCompetitionId) return [];
        const comp = competitions.find(c => c.id === selectedCompetitionId);
        if (!comp) return [];
        return pods.filter(p => comp.podIds?.includes(p.id));
    }, [selectedCompetitionId, competitions, pods]);

   useEffect(() => {
    if (!selectedCompetitionId || !selectedPodId) {
        setGameResults([]);
        setTeams([]);
        setIsLoadingData(false);
        return;
    }
    setIsLoadingData(true);
    let unsubResults: Unsubscribe | undefined;
    let unsubBonuses: Unsubscribe | undefined;

    const fetchData = async () => {
        try {
            const compDocRef = doc(db, 'competitions', selectedCompetitionId);
            const compDoc = await getDoc(compDocRef);
            if(compDoc.exists()){
                 const compData = compDoc.data() as CompetitionWithTeams;
                 setTeams(compData.teams || []);
            }

            const todayStart = startOfDay(selectedDate);
            const todayEnd = endOfDay(selectedDate);
            const qResults = query(
                collection(db, 'rpsGames'),
                where('timestamp', '>=', todayStart),
                where('timestamp', '<=', todayEnd)
            );
             unsubResults = onSnapshot(qResults, (snap) => {
                const results = snap.docs.map(d => d.data() as GameResult);
                const podAgentIds = pods.find(p => p.id === selectedPodId)?.agentIds || [];
                const podResults = results.filter(r => r.userId && podAgentIds.includes(r.userId));
                setGameResults(podResults);
            });

            const bonusesRef = collection(db, 'teamBonusLogs');
            const qBonuses = query(bonusesRef,
                where('podId', '==', selectedPodId),
                where('competitionId', '==', selectedCompetitionId),
                where('date', '==', Timestamp.fromDate(todayStart)),
                where('reason', '==', 'RPS Bonus')
            );
            unsubBonuses = onSnapshot(qBonuses, (snap) => {
                setAwardedPointsToday(!snap.empty);
            });

        } catch (e) {
            setError("Failed to load game data.");
            console.error(e);
        } finally {
             setIsLoadingData(false);
        }
    };
    fetchData();

    return () => {
        if (unsubResults) unsubResults();
        if (unsubBonuses) unsubBonuses();
    }
   }, [selectedCompetitionId, selectedPodId, selectedDate, pods]);

   const teamStats = useMemo((): TeamStats[] => {
        const stats: Record<string, TeamStats> = {};
        teams.forEach(team => {
            stats[team.id] = {id: team.id, name: team.name, emoji: team.emoji, wins: 0, losses: 0, draws: 0};
        });

        gameResults.forEach(result => {
            if (!result.userId) return;
            const agentTeam = teams.find(t => t.agentIds.includes(result.userId!));
            if(agentTeam && stats[agentTeam.id]) {
                if(result.result === 'win') stats[agentTeam.id].wins++;
                else if(result.result === 'loss') stats[agentTeam.id].losses++;
                else if(result.result === 'draw') stats[agentTeam.id].draws++;
            }
        });

        const sortedStats = Object.values(stats).sort((a,b) => b.wins - a.wins);

        // Dense Ranking
        const rankedStats: TeamStats[] = [];
        let currentRank = 0;
        let lastWins = -1;
        sortedStats.forEach((team) => {
             if (team.wins !== lastWins) {
                currentRank++;
             }
             rankedStats.push({ ...team, rank: currentRank });
             lastWins = team.wins;
        });

        return rankedStats;
   }, [teams, gameResults]);

   const handleAwardPoints = async () => {
        if (!selectedPodId || !selectedCompetitionId) return;
        const currentUser = auth.currentUser;
        if (!currentUser) {
            toast({variant: "destructive", title: "Authentication Error", description: "You must be logged in to award points."});
            return;
        }

        setIsAwardingPoints(true);
        const topTeams = teamStats.filter(t => t.rank && t.rank <=3 && t.wins > 0);
        if (topTeams.length === 0) {
            toast({title: "No Winners", description: "No teams have wins to award points to."});
            setIsAwardingPoints(false);
            return;
        }
        const pointsMap: Record<number, number> = { 1: 15, 2: 10, 3: 5 };

        try {
            const batch = writeBatch(db);
            const dateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));

            topTeams.forEach(team => {
                const points = pointsMap[team.rank!];
                if (points) {
                     const bonusLog: Omit<TeamBonusLog, 'id'> = {
                        teamId: team.id,
                        podId: selectedPodId,
                        competitionId: selectedCompetitionId,
                        points,
                        reason: 'RPS Bonus',
                        date: dateTimestamp,
                        loggedAt: serverTimestamp() as Timestamp,
                        loggedBy: currentUser.uid,
                    };
                    const newLogRef = doc(collection(db, 'teamBonusLogs'));
                    batch.set(newLogRef, bonusLog);
                }
            });
            await batch.commit();
            toast({title: "Points Awarded", description: "Bonus points have been assigned to top teams."});
        } catch (e) {
            console.error(e);
            toast({variant: "destructive", title: "Error", description: "Failed to award bonus points."});
        } finally {
            setIsAwardingPoints(false);
        }
   };

    const isLoading = isLoadingBase || isLoadingData;

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> RPS Score Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
             <div className="grid gap-2">
                <Label htmlFor="competition-select">Competition</Label>
                <Select onValueChange={handleCompetitionChange} value={selectedCompetitionId} disabled={isLoadingBase}><SelectTrigger id="competition-select" className="w-[250px]"><SelectValue placeholder="Select Competition" /></SelectTrigger><SelectContent>{competitions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="pod-select">Pod</Label>
                <Select onValueChange={handlePodChange} value={selectedPodId} disabled={!selectedCompetitionId || isLoadingBase}><SelectTrigger id="pod-select" className="w-[200px]"><SelectValue placeholder="Select Pod" /></SelectTrigger><SelectContent>{availablePods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="date-select">Date</Label>
                <Popover><PopoverTrigger asChild><Button id="date-select" variant="outline" className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "PPP") : "Pick date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 z-50"><Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus/></PopoverContent></Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>RPS Team Results</CardTitle>
            <CardDescription>Daily Rock-Paper-Scissors win/loss record by team.</CardDescription>
          </div>
          <Button onClick={handleAwardPoints} disabled={isLoading || isAwardingPoints || awardedPointsToday || teamStats.filter(t => t.wins > 0).length === 0} title={awardedPointsToday ? "Points already awarded for this day." : ""}>
            {isAwardingPoints ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Award className="mr-2 h-4 w-4" />}
            {awardedPointsToday ? "Points Awarded" : "Award Bonus Points"}
          </Button>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="space-y-2"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>
            ) : !selectedPodId || !selectedCompetitionId ? (
                <p className="text-muted-foreground text-center py-6">Please select a competition and pod to view results.</p>
            ) : teamStats.length === 0 ? (
                 <p className="text-muted-foreground text-center py-6">No teams configured for this competition.</p>
            ) : (
                <Table>
                    <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Team</TableHead><TableHead className="text-center">Wins</TableHead><TableHead className="text-center">Losses</TableHead><TableHead className="text-center">Draws</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {teamStats.map(team => (
                            <TableRow key={team.id}>
                                <TableCell className="font-bold">{team.rank}</TableCell>
                                <TableCell className="font-medium">{team.emoji} {team.name}</TableCell>
                                <TableCell className="text-center text-green-600 font-semibold">{team.wins}</TableCell>
                                <TableCell className="text-center text-red-600">{team.losses}</TableCell>
                                <TableCell className="text-center text-gray-500">{team.draws}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
