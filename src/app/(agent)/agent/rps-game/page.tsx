
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hand, Hourglass, BarChart2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, query, where, Timestamp, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { startOfDay, endOfDay } from 'date-fns';

type Throw = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'loss' | 'draw';

interface GameResult {
  userId: string | null;
  userThrow: Throw;
  opponentThrow: Throw;
  result: Result;
  timestamp: Timestamp;
}

const RPS_COOLDOWN_KEY = 'rps_next_playable_time';

export default function RpsGamePage() {
  const [playerThrow, setPlayerThrow] = useState<Throw | null>(null);
  const [opponentThrow, setOpponentThrow] = useState<Throw | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [dailyStats, setDailyStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [isLoading, setIsLoading] = useState(false);
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
    // For unauthenticated users, we can't fetch stats.
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
    fetchDailyStats();
    
    const interval = setInterval(() => {
      const nextPlayableTime = parseInt(localStorage.getItem(RPS_COOLDOWN_KEY) || '0', 10);
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((nextPlayableTime - now) / 1000));
      setCooldown(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchDailyStats]);

  const handleThrow = async (choice: Throw) => {
    if (cooldown > 0) {
      toast({ title: 'Cooldown Active', description: `You can play again in ${cooldown} seconds.` });
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
      await addDoc(collection(db, 'rpsGames'), {
        userId: auth.currentUser?.uid || null, // Allow anonymous play
        userThrow: choice,
        opponentThrow: opponentChoice,
        result: gameResult,
        timestamp: Timestamp.now(),
      });

      // Set cooldown for 15 minutes (900,000 milliseconds)
      const nextPlayableTime = new Date().getTime() + 15 * 60 * 1000;
      localStorage.setItem(RPS_COOLDOWN_KEY, nextPlayableTime.toString());
      setCooldown(900); // 15 mins in seconds

      toast({
        title: `You ${gameResult === 'draw' ? 'drew' : gameResult}!`,
        description: `You threw ${choice}, opponent threw ${opponentChoice}.`,
      });

      // Refetch stats after a game
      await fetchDailyStats();
    } catch (error) {
      console.error('Error saving game result:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save your game. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start pt-8">
      <Card className="w-full max-w-md frosted-glass">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Rock, Paper, Scissors</CardTitle>
          <CardDescription>Win bonus points for your team!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-around">
            <Button
              variant="outline"
              size="lg"
              className="text-4xl p-6 h-24 w-24"
              onClick={() => handleThrow('rock')}
              disabled={isLoading || cooldown > 0}
            >
              ✊
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-4xl p-6 h-24 w-24"
              onClick={() => handleThrow('paper')}
              disabled={isLoading || cooldown > 0}
            >
              ✋
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-4xl p-6 h-24 w-24"
              onClick={() => handleThrow('scissors')}
              disabled={isLoading || cooldown > 0}
            >
              ✌️
            </Button>
          </div>

          <div className="min-h-[80px] flex flex-col items-center justify-center text-center p-4 border rounded-lg bg-muted/50">
            {isLoading && <p>Throwing...</p>}
            {!isLoading && cooldown > 0 && (
              <div className="flex items-center gap-2 text-lg">
                <Hourglass className="h-5 w-5 animate-spin" />
                Play again in {Math.floor(cooldown / 60)}:{(cooldown % 60).toString().padStart(2, '0')}
              </div>
            )}
            {!isLoading && cooldown === 0 && result && (
              <div className="space-y-2">
                <p className="text-xl">
                  You threw {getThrowIcon(playerThrow)}, the app threw {getThrowIcon(opponentThrow)}.
                </p>
                <p className="text-2xl font-bold uppercase text-primary">
                  You {result === 'draw' ? 'Drew' : result}!
                </p>
              </div>
            )}
             {!isLoading && cooldown === 0 && !result && (
                <p className="text-muted-foreground">Make your throw!</p>
             )}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Today's Stats
                </CardTitle>
                 <CardDescription>W-L-D</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold text-center tracking-widest">
                    {dailyStats.wins}-{dailyStats.losses}-{dailyStats.draws}
                </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
