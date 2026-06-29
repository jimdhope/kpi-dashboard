
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hand, Hourglass, BarChart2, Swords, Trophy, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startOfDay, endOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Throw = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'loss' | 'draw';

interface AppUser {
  id: string;
  name: string;
  email: string;
  podId?: string | null;
}

interface GameResult {
  id: string;
  playerId: string | null;
  playerThrow: Throw;
  opponentThrow: Throw;
  result: Result;
  createdAt: string;
}

interface Team {
    id: string;
    name: string;
    emoji?: string;
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

const THROWS: Throw[] = ['rock', 'paper', 'scissors'];

const RPS_COOLDOWN_KEY = 'rps_next_playable_time';

export default function RpsGamePage() {
  const [playerThrow, setPlayerThrow] = useState<Throw | null>(null);
  const [opponentThrow, setOpponentThrow] = useState<Throw | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [dailyStats, setDailyStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStandings, setIsLoadingStandings] = useState(true);

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [podGameResults, setPodGameResults] = useState<GameResult[]>([]);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const throwRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { toast } = useToast();

  // Handle keyboard navigation for throw selection
  const handleKeyDown = useCallback((e: React.KeyboardEvent, throwChoice: Throw) => {
    if (isLoading || cooldown > 0) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev === 0 ? THROWS.length - 1 : prev - 1;
          throwRefs.current[newIndex]?.focus();
          return newIndex;
        });
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = (prev + 1) % THROWS.length;
          throwRefs.current[newIndex]?.focus();
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = prev === 0 ? THROWS.length - 1 : prev - 1;
          throwRefs.current[newIndex]?.focus();
          return newIndex;
        });
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = (prev + 1) % THROWS.length;
          throwRefs.current[newIndex]?.focus();
          return newIndex;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleThrow(throwChoice);
        break;
    }
  }, [isLoading, cooldown]);

  // Reset selection when game becomes available
  useEffect(() => {
    if (cooldown === 0 && !isLoading) {
      setSelectedIndex(0);
      setTimeout(() => throwRefs.current[0]?.focus(), 100);
    }
  }, [cooldown, isLoading]);

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

  const fetchDailyStats = useCallback(async (userId: string) => {
    try {
      const res = await fetch('/api/rps-games?limit=100');
      if (!res.ok) return;
      
      const data = await res.json();
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      
      const todayGames = (data.games || []).filter((g: GameResult) => {
        const gameDate = new Date(g.createdAt);
        return g.playerId === userId && gameDate >= todayStart && gameDate <= todayEnd;
      });
      
      const stats = { wins: 0, losses: 0, draws: 0 };
      todayGames.forEach((g: GameResult) => {
        if (g.result === 'win') stats.wins++;
        else if (g.result === 'loss') stats.losses++;
        else if (g.result === 'draw') stats.draws++;
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
    
    async function fetchData() {
      try {
        const [userRes, usersRes, compsRes, gamesRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/users'),
          fetch('/api/competitions'),
          fetch('/api/rps-games?limit=100'),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setCurrentUser(userData.user);
          const podId = userData.user?.podId;

          if (podId) {
            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());

            if (usersRes.ok) {
              const usersData = await usersRes.json();
              const podAgentList = (usersData.users || []).filter((u: AppUser) => u.podId === podId);
              setPodAgents(podAgentList);
            }

            if (compsRes.ok) {
              const compsData = await compsRes.json();
              const activeComp = (compsData.competitions || []).find((c: any) => {
                const startsAt = c.startsAt ? new Date(c.startsAt) : null;
                const endsAt = c.endsAt ? new Date(c.endsAt) : null;
                return startsAt && endsAt && startsAt <= todayStart && endsAt >= todayStart;
              });
              
              if (activeComp?.teams) {
                setTeams(activeComp.teams);
              }
            }

            if (gamesRes.ok) {
              const gamesData = await gamesRes.json();
              const podAgentIds = podAgents.map(a => a.id);
              const todayGames = (gamesData.games || []).filter((g: GameResult) => {
                const gameDate = new Date(g.createdAt);
                return g.playerId && podAgentIds.includes(g.playerId) && gameDate >= todayStart && gameDate <= todayEnd;
              });
              setPodGameResults(todayGames);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingStandings(false);
      }
    }

    fetchData();

    const interval = setInterval(() => {
      const nextPlayableTime = parseInt(localStorage.getItem(RPS_COOLDOWN_KEY) || '0', 10);
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((nextPlayableTime - now) / 1000));
      setCooldown(remaining);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);


  const teamStats = useMemo((): TeamStats[] => {
    const stats: Record<string, TeamStats> = {};
    teams.forEach(team => {
        stats[team.id] = { id: team.id, name: team.name, emoji: team.emoji, wins: 0, losses: 0, draws: 0 };
    });

    podGameResults.forEach(result => {
        if (!result.playerId) return;
        const agentTeam = teams.find(t => t.id === result.playerId);
        if (agentTeam && stats[agentTeam.id]) {
            if (result.result === 'win') stats[agentTeam.id].wins++;
            else if (result.result === 'loss') stats[agentTeam.id].losses++;
            else if (result.result === 'draw') stats[agentTeam.id].draws++;
        }
    });

    const sortedStats = Object.values(stats).sort((a, b) => b.wins - a.wins);

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
    if (!currentUser) {
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
      const res = await fetch('/api/rps-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerThrow: choice,
          opponentThrow: opponentChoice,
          result: gameResult,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save game');
      }

      const { game } = await res.json();
      setPodGameResults(prev => [...prev, { ...game, playerId: currentUser.id }]);

      const nextPlayableTime = new Date().getTime() + 15 * 60 * 1000;
      localStorage.setItem(RPS_COOLDOWN_KEY, nextPlayableTime.toString());
      setCooldown(900);

      toast({
        title: `You ${gameResult === 'draw' ? 'drew' : gameResult}!`,
        description: `You threw ${choice}, opponent threw ${opponentChoice}.`,
      });

      await fetchDailyStats(currentUser.id);
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
            <div 
              className="flex justify-around"
              role="radiogroup"
              aria-label="Choose your throw"
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const direction = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
                  setSelectedIndex((prev) => {
                    const newIndex = (prev + direction + THROWS.length) % THROWS.length;
                    setTimeout(() => throwRefs.current[newIndex]?.focus(), 10);
                    return newIndex;
                  });
                }
              }}
            >
              <Button 
                ref={(el) => { throwRefs.current[0] = el; }} 
                variant="outline" 
                size="lg" 
                className={cn(
                  "text-4xl p-6 h-24 w-24 transition-all",
                  selectedIndex === 0 && !isLoading && cooldown === 0 && "ring-2 ring-primary ring-offset-2 bg-primary/10"
                )} 
                onClick={() => handleThrow('rock')} 
                onKeyDown={(e) => handleKeyDown(e, 'rock')}
                disabled={isLoading || cooldown > 0}
                role="radio"
                aria-checked={selectedIndex === 0}
                aria-label="Rock"
                tabIndex={selectedIndex === 0 ? 0 : -1}
              >
                ✊
                <span className="sr-only">Rock</span>
              </Button>
              <Button 
                ref={(el) => { throwRefs.current[1] = el; }} 
                variant="outline" 
                size="lg" 
                className={cn(
                  "text-4xl p-6 h-24 w-24 transition-all",
                  selectedIndex === 1 && !isLoading && cooldown === 0 && "ring-2 ring-primary ring-offset-2 bg-primary/10"
                )} 
                onClick={() => handleThrow('paper')} 
                onKeyDown={(e) => handleKeyDown(e, 'paper')}
                disabled={isLoading || cooldown > 0}
                role="radio"
                aria-checked={selectedIndex === 1}
                aria-label="Paper"
                tabIndex={selectedIndex === 1 ? 0 : -1}
              >
                ✋
                <span className="sr-only">Paper</span>
              </Button>
              <Button 
                ref={(el) => { throwRefs.current[2] = el; }} 
                variant="outline" 
                size="lg" 
                className={cn(
                  "text-4xl p-6 h-24 w-24 transition-all",
                  selectedIndex === 2 && !isLoading && cooldown === 0 && "ring-2 ring-primary ring-offset-2 bg-primary/10"
                )} 
                onClick={() => handleThrow('scissors')} 
                onKeyDown={(e) => handleKeyDown(e, 'scissors')}
                disabled={isLoading || cooldown > 0}
                role="radio"
                aria-checked={selectedIndex === 2}
                aria-label="Scissors"
                tabIndex={selectedIndex === 2 ? 0 : -1}
              >
                ✌️
                <span className="sr-only">Scissors</span>
              </Button>
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
              {!isLoading && !result && cooldown === 0 && (
                <p className="text-muted-foreground">
                  Make your throw! <span className="text-xs">(Use arrow keys or Tab to select, Enter to confirm)</span>
                </p>
              )}
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
                    <TableRow key={team.id} className={cn(team.id === currentUser?.podId && 'bg-accent/50')}>
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
