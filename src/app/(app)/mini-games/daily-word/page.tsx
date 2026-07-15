'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DailyLeaderboard, formatDuration, type DailyLeaderboardEntry } from '@/components/mini-games/daily-leaderboard';

type Mark = 'correct' | 'present' | 'absent';
interface WordData {
  attempt: {
    status: string; content: { maxGuesses: number }; answer?: string;
    state?: { rows: Array<{ guess: string; marks: Mark[] }> }; guesses?: number; durationMs?: number;
  };
  leaderboard: DailyLeaderboardEntry[];
}

export default function DailyWordPage() {
  const [data, setData] = useState<WordData | null>(null);
  const [guess, setGuess] = useState('');
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const load = useCallback(async () => {
    const response = await fetch('/api/mini-games/daily/daily-word', { cache: 'no-store' });
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (body: object) => {
    setPending(true);
    const response = await fetch('/api/mini-games/daily/daily-word', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (response.ok) { setData(result); setGuess(''); }
    else toast({ variant: 'destructive', title: 'Try another word', description: result.error });
    setPending(false);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); if (guess.length === 5) act({ action: 'guess', guess }); };
  if (!data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  const rows = data.attempt.state?.rows || [];
  const finished = ['completed', 'failed'].includes(data.attempt.status);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><h1 className="text-3xl font-bold">Daily Word</h1><p className="text-muted-foreground">Find today&apos;s five-letter word in six guesses.</p></div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card variant="glass">
          <CardHeader><CardTitle>Today&apos;s Puzzle</CardTitle><CardDescription>Green is correct; amber is present in another position.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {data.attempt.status === 'not_started' ? <div className="py-12 text-center"><Button size="lg" disabled={pending} onClick={() => act({ action: 'start' })}>Start Daily Word</Button></div> : <>
              <div className="mx-auto grid max-w-xs gap-2" aria-label="Word guesses">
                {Array.from({ length: 6 }, (_, rowIndex) => {
                  const row = rows[rowIndex];
                  return <div key={rowIndex} className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }, (_, col) => {
                    const mark = row?.marks[col];
                    return <div key={col} className={cn('flex aspect-square items-center justify-center rounded-md border text-2xl font-bold uppercase',
                      mark === 'correct' && 'border-green-600 bg-green-600 text-white', mark === 'present' && 'border-amber-500 bg-amber-500 text-white', mark === 'absent' && 'border-slate-600 bg-slate-600 text-white')}>{row?.guess[col] || ''}</div>;
                  })}</div>;
                })}
              </div>
              {!finished ? <form onSubmit={submit} className="mx-auto flex max-w-sm gap-2">
                <Input value={guess} maxLength={5} autoCapitalize="none" autoComplete="off" aria-label="Five-letter guess" className="text-center uppercase tracking-[0.35em]" onChange={e => setGuess(e.target.value.replace(/[^a-z]/gi, '').toLowerCase())} />
                <Button disabled={pending || guess.length !== 5}>Guess</Button>
              </form> : <div className="rounded-lg bg-muted/40 p-4 text-center">
                <p className="text-xl font-bold">{data.attempt.status === 'completed' ? 'Solved!' : 'Better luck tomorrow'}</p>
                <p className="text-muted-foreground">The word was <span className="font-bold uppercase text-foreground">{data.attempt.answer}</span></p>
                {data.attempt.status === 'completed' && <p className="text-sm">{data.attempt.guesses} guesses · {formatDuration(data.attempt.durationMs)}</p>}
              </div>}
            </>}
          </CardContent>
        </Card>
        <DailyLeaderboard entries={data.leaderboard} game="daily-word" />
      </div>
    </div>
  );
}
