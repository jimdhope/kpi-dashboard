'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DailyLeaderboard, type DailyLeaderboardEntry } from '@/components/mini-games/daily-leaderboard';

interface GameData {
  attempt: { status: string; content: { current?: number; length: number }; state?: { index: number; streak: number }; score?: number };
  leaderboard: DailyLeaderboardEntry[];
}

export default function HigherLowerPage() {
  const [data, setData] = useState<GameData | null>(null);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const load = useCallback(async () => {
    const response = await fetch('/api/mini-games/daily/higher-lower', { cache: 'no-store' });
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (body: object) => {
    setPending(true);
    const response = await fetch('/api/mini-games/daily/higher-lower', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (response.ok) setData(result); else toast({ variant: 'destructive', title: 'Unable to play', description: result.error });
    setPending(false);
  };
  if (!data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  const { attempt } = data;
  const finished = ['completed', 'failed'].includes(attempt.status);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><h1 className="text-3xl font-bold">Higher or Lower</h1><p className="text-muted-foreground">One shared challenge and one run each day.</p></div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card variant="glass">
          <CardHeader><CardTitle>Today&apos;s Run</CardTitle><CardDescription>Predict the next number. One wrong answer ends the run.</CardDescription></CardHeader>
          <CardContent className="space-y-7 text-center">
            {attempt.status === 'not_started' ? (
              <div className="space-y-5 py-12"><p className="text-muted-foreground">You cannot restart after beginning.</p><Button size="lg" disabled={pending} onClick={() => act({ action: 'start' })}>Start Daily Run</Button></div>
            ) : (
              <>
                <div><p className="text-sm uppercase tracking-wide text-muted-foreground">Current number</p><div className="my-4 text-8xl font-black tabular-nums text-primary">{attempt.content.current}</div><p className="font-medium">Streak: {attempt.state?.streak ?? attempt.score ?? 0}</p></div>
                {!finished ? <div className="grid grid-cols-2 gap-4">
                  <Button className="h-20 text-lg" disabled={pending} onClick={() => act({ action: 'guess', guess: 'lower' })}><ArrowDown className="mr-2 h-6 w-6" />Lower</Button>
                  <Button className="h-20 text-lg" disabled={pending} onClick={() => act({ action: 'guess', guess: 'higher' })}><ArrowUp className="mr-2 h-6 w-6" />Higher</Button>
                </div> : <div className="rounded-lg bg-muted/40 p-5"><p className="text-xl font-bold">{attempt.status === 'completed' ? 'Sequence completed!' : 'Run finished'}</p><p className="text-muted-foreground">Final streak: {attempt.score}</p><p className="mt-2 text-sm">Come back after UK midnight for a new challenge.</p></div>}
              </>
            )}
          </CardContent>
        </Card>
        <DailyLeaderboard entries={data.leaderboard} game="higher-lower" />
      </div>
    </div>
  );
}
