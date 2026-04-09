'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Swords, Trophy } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials, cn } from '@/lib/utils';

type Throw = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'loss' | 'draw';

interface GameResult {
  id: string;
  playerId: string | null;
  playerThrow: Throw;
  opponentThrow: Throw;
  result: Result;
  createdAt: string;
}

interface AppUser {
  id: string;
  name: string;
  email: string;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  wins: number;
  rank: number;
}

interface GameLeaderboard {
  id: string;
  name: string;
  icon: typeof Swords;
  color: string;
  bgColor: string;
  href: string;
  entries: LeaderboardEntry[];
}

const getMedalStyle = (rank: number) => {
  switch (rank) {
    case 1: return 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50';
    case 2: return 'bg-gray-400/30 text-gray-300 border-gray-400/50';
    case 3: return 'bg-orange-400/30 text-orange-400 border-orange-400/50';
    default: return 'bg-muted/30 text-muted-foreground border-muted';
  }
};

const getMedalEmoji = (rank: number) => {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return null;
  }
};

export default function MiniGamesDashboard() {
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [rpsGames, setRpsGames] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, gamesRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/rps-games?limit=100'),
        ]);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAgents(usersData.users || []);
        }

        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          setRpsGames(gamesData.games || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const rpsLeaderboard = useMemo((): LeaderboardEntry[] => {
    const agentWins: Record<string, number> = {};
    
    rpsGames.forEach(game => {
      if (game.result === 'win' && game.playerId) {
        agentWins[game.playerId] = (agentWins[game.playerId] || 0) + 1;
      }
    });

    const leaderboard = Object.entries(agentWins)
      .map(([userId, wins]) => {
        const agent = agents.find(a => a.id === userId);
        return {
          userId,
          name: agent?.name || 'Unknown',
          wins,
          email: agent?.email || '',
        };
      })
      .filter(entry => !entry.email.toLowerCase().endsWith('@test.com'))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [rpsGames, agents]);

  const gameLeaderboards: GameLeaderboard[] = [
    {
      id: 'rps',
      name: 'Rock Paper Scissors',
      icon: Swords,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      href: '/mini-games/rps',
      entries: rpsLeaderboard,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mini Games</h1>
        <p className="text-muted-foreground">Game Leaderboards</p>
      </div>

      {gameLeaderboards.map((game) => {
        const Icon = game.icon;
        return (
          <Card key={game.id} className="frosted-glass overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${game.bgColor}`}>
                    <Icon className={`h-6 w-6 ${game.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{game.name}</CardTitle>
                    <CardDescription>
                      {game.entries.length > 0 
                        ? `Top ${game.entries.length} players by total wins`
                        : 'No games played yet'}
                    </CardDescription>
                  </div>
                </div>
                <a 
                  href={game.href}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Play Game
                </a>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {game.entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No games played yet</p>
                  <p className="text-sm">Be the first to play!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {game.entries.map((entry) => (
                    <div
                      key={entry.userId}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg transition-colors",
                        entry.rank <= 3 ? 'bg-muted/50' : 'hover:bg-muted/30'
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border",
                        getMedalStyle(entry.rank)
                      )}>
                        {getMedalEmoji(entry.rank) || entry.rank}
                      </div>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-sm">
                          {generateInitials(entry.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">
                          {entry.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-bold text-lg tabular-nums",
                          entry.rank <= 3 ? 'text-foreground' : 'text-primary'
                        )}>
                          {entry.wins}
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">
                          {entry.wins === 1 ? 'win' : 'wins'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {gameLeaderboards.every(g => g.entries.length === 0) && (
        <Card className="frosted-glass">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No Games Available</p>
              <p className="text-sm">Check back later for fun games!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
