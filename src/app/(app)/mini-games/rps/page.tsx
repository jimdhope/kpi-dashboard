
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hand, Hourglass, BarChart2, Swords, Trophy, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, query, where, Timestamp, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { startOfDay, endOfDay } from 'date-fns';
import { AppUser } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
  }>;
}

type Throw = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'loss' | 'draw';

interface GameResult {
  userId: string | null;
  userThrow: Throw;
  opponentThrow: Throw;
  result: Result;
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


const RPS_COOLDOWN_KEY = 'rps_next_playable_time';

export default function RpsGamePage() {
  const [playerThrow, setPlayerThrow] = useState<Throw | null>(null);
  const [opponentThrow, setOpponentThrow] = useState<Throw | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [dailyStats, setDailyStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStandings, setIsLoadingStandings] = useState(true);

  // New state for standings data
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [podGameResults, setPodGameResults] = useState<GameResult[]>([]);

  const { toast } = useToast();

  const getThrowIcon = (hand: Throw | null) => {
    switch (hand) {
      case 'rock':
        return '✊';
      case 'paper':
        return '✋';
      case 'scissors':
        return '✌️';
      default:
        return '❔';
    }
  };

  const calculateWinner = (player: Throw, opponent: Throw): Result => {
    if (player === opponent) return 'draw';
    if (
      (player === 'rock' && opponent === 'scissors') ||
      (player === 'scissors' && opponent === 'paper') ||
      (player === 'paper' && opponent === 'rock')
    ) {
      return 'win';
    }
    return 'loss';
  };

  const fetchDailyStats = useCallback(async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const q = query(
        collection(db, 'rpsGames'),
        where('userId', '==', userId),
        where('timestamp', '>=', todayStart),
        where('timestamp', '<=', todayEnd)
      );

      const querySnapshot = await getDocs(q);
      const stats = { wins: 0, losses: 0, draws: 0 };
      querySnapshot.forEach((doc) => {
        const data = doc.data() as GameResult;
        if (data.result === 'win') stats.wins++;
        else if (data.result === 'loss') stats.losses++;
        else if (data.result === 'draw') stats.draws++;
      });
      setDailyStats(stats);
    } catch (error) {
      console.error("Error fetching daily stats:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load your daily game stats.',
      });
    }
  }, [toast]);


   useEffect(() => {
    setIsLoadingStandings(true);
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Fetch current user's data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() } as AppUser;
          setCurrentUser(userData);
          const podId = userData.podId;

          if (podId) {
            // Fetch agents in the same pod
            const agentsQuery = query(collection(db, 'users'), where('podId', '==', podId));
            const agentsSnapshot = await getDocs(agentsQuery);
            const podAgentList = agentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
            const podAgentIds = podAgentList.map(a => a.id);
            setPodAgents(podAgentList);

            // Fetch active competition for the pod
            const todayStart = startOfDay(new Date());
            const compQuery = query(
              collection(db, 'competitions'),
              where('podIds', 'array-contains', podId),
              where('startDate', '<=', Timestamp.fromDate(todayStart)),
              orderBy('startDate', 'desc')
            );
            const compSnapshot = await getDocs(compQuery);
            let activeCompetition: CompetitionWithTeams | null = null;
            for (const docSnap of compSnapshot.docs) {
                const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithTeams;
                if (comp.endDate && comp.endDate.toDate() >= todayStart) {
                    activeCompetition = comp;
                    break;
                }
            }

            if (activeCompetition && activeCompetition.teams) {
                setTeams(activeCompetition.teams);
            }

             // Fetch today's game results for the whole pod
             const todayEnd = endOfDay(new Date());
             if (podAgentIds.length > 0) {
                 const gamesQuery = query(
                     collection(db, 'rpsGames'),
                     where('userId', 'in', podAgentIds),
                     where('timestamp', '>=', todayStart),
                     where('timestamp', '<=', todayEnd)
                 );
                 const gamesSnapshot = await getDocs(gamesQuery);
                 setPodGameResults(gamesSnapshot.docs.map(d => d.data() as GameResult));
             }
          }
        }
      } else {
        setCurrentUser(null);
      }
      setIsLoadingStandings(false);
    });

    const interval = setInterval(() => {
      const nextPlayableTime = parseInt(localStorage.getItem(RPS_COOLDOWN_KEY) || '0', 10);
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((nextPlayableTime - now) / 1000));
      setCooldown(remaining);
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribeAuth();
    };
  }, [fetchDailyStats]);


  const teamStats = useMemo((): TeamStats[] => {
    const stats: Record<string, TeamStats> = {};
    teams.forEach(team => {
        stats[team.id] = { id: team.id, name: team.name, emoji: team.emoji, wins: 0, losses: 0, draws: 0 };
    });

    podGameResults.forEach(result => {
        if (!result.userId) return;
        const agentTeam = teams.find(t => t.agentIds.includes(result.userId!));
        if (agentTeam && stats[agentTeam.id]) {
            if (result.result === 'win') stats[agentTeam.id].wins++;
            else if (result.result === 'loss') stats[agentTeam.id].losses++;
            else if (result.result === 'draw') stats[agentTeam.id].draws++;
        }
    });

    const sortedStats = Object.values(stats).sort((a, b) => b.wins - a.wins);

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
  }, [teams, podGameResults]);


  const handleThrow = async (choice: Throw) => {
    if (cooldown > 0) {
      toast({ title: 'Cooldown Active', description: `You can play again in ${cooldown} seconds.` });
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Logged In', description: 'You must be logged in to play.' });
      return;
    }

    setIsLoading(true);
    setPlayerThrow(choice);

    const throws: Throw[] = ['rock', 'paper', 'scissors'];
    const opponentChoice = throws[Math.floor(Math.random() * throws.length)];
    setOpponentThrow(opponentChoice);

    const gameResult = calculateWinner(choice, opponentChoice);
    setResult(gameResult);

    try {
      const gameDoc = {
        userId: user.uid,
        userThrow: choice,
        opponentThrow: opponentChoice,
        result: gameResult,
        timestamp: Timestamp.now(),
      };
      await addDoc(collection(db, 'rpsGames'), gameDoc);

      setPodGameResults(prev => [...prev, gameDoc as GameResult]); // Optimistically update standings

      const nextPlayableTime = new Date().getTime() + 15 * 60 * 1000;
      localStorage.setItem(RPS_COOLDOWN_KEY, nextPlayableTime.toString());
      setCooldown(900);

      toast({
        title: `You ${gameResult === 'draw' ? 'drew' : gameResult}!`,
        description: `You threw ${choice}, opponent threw ${opponentChoice}.`,
      });

      await fetchDailyStats();
    } catch (error) {
      console.error('Error saving game result:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save your game. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center items-start">
        <Card className="w-full max-w-md frosted-glass">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Rock, Paper, Scissors</CardTitle>
            <CardDescription>Win bonus points for your team!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-around">
              <Button variant="outline" size="lg" className="text-4xl p-6 h-24 w-24" onClick={() => handleThrow('rock')} disabled={isLoading || cooldown > 0}>✊</Button>
              <Button variant="outline" size="lg" className="text-4xl p-6 h-24 w-24" onClick={() => handleThrow('paper')} disabled={isLoading || cooldown > 0}>✋</Button>
              <Button variant="outline" size="lg" className="text-4xl p-6 h-24 w-24" onClick={() => handleThrow('scissors')} disabled={isLoading || cooldown > 0}>✌️</Button>
            </div>

            <div className="min-h-[80px] flex flex-col items-center justify-center text-center p-4 border rounded-lg bg-muted/50 space-y-2">
              {isLoading && <p>Throwing...</p>}
              {!isLoading && result && (
                <div className="space-y-1">
                  <p className="text-xl">You threw {getThrowIcon(playerThrow)}, the app threw {getThrowIcon(opponentThrow)}.</p>
                  <p className="text-2xl font-bold uppercase text-primary">You {result === 'draw' ? 'Drew' : result}!</p>
                </div>
              )}
              {!isLoading && cooldown > 0 && (
                <div className="flex items-center gap-2 text-lg">
                  <Hourglass className="h-5 w-5 animate-spin" />
                  Play again in {Math.floor(cooldown / 60)}:{(cooldown % 60).toString().padStart(2, '0')}
                </div>
              )}
              {!isLoading && !result && cooldown === 0 && (<p className="text-muted-foreground">Make your throw!</p>)}
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2"><BarChart2 className="h-4 w-4" />Today's Stats</CardTitle>
                <CardDescription>W-L-D</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-center tracking-widest">{dailyStats.wins}-{dailyStats.losses}-{dailyStats.draws}</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

       <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Today's Team Standings</CardTitle>
          <CardDescription>Live results for all teams in your pod.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStandings ? (
            <div className="space-y-2"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>
          ) : teamStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No team data available. Your pod may not be in an active competition with teams.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Team</TableHead><TableHead className="text-center">Wins</TableHead><TableHead className="text-center">Losses</TableHead><TableHead className="text-center">Draws</TableHead></TableRow></TableHeader>
              <TableBody>
                {teamStats.map(team => (
                  <TableRow key={team.id} className={cn(team.id === teams.find(t => t.agentIds.includes(currentUser?.id || ''))?.id && 'bg-accent/50')}>
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
