'use client';

import { KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { Eraser, Lightbulb, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DailyLeaderboard, formatDuration, type DailyLeaderboardEntry } from '@/components/mini-games/daily-leaderboard';

type Difficulty = 'easy' | 'medium' | 'hard';
interface SudokuData {
  attempt: {
    status: string; content: { puzzle: number[]; difficulty: Difficulty };
    state?: { board: number[]; notes: Record<string, number[]> };
    mistakes: number; hints: number; durationMs?: number; score?: number;
  };
  leaderboard: DailyLeaderboardEntry[];
}

export default function SudokuPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [data, setData] = useState<SudokuData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const load = useCallback(async (level: Difficulty) => {
    setData(null); setSelected(null);
    const response = await fetch(`/api/mini-games/daily/sudoku?variant=${level}`, { cache: 'no-store' });
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => { load(difficulty); }, [difficulty, load]);
  const act = async (body: object) => {
    setPending(true);
    const response = await fetch('/api/mini-games/daily/sudoku', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, variant: difficulty }) });
    const result = await response.json();
    if (response.ok) setData(result); else toast({ variant: 'destructive', title: 'Unable to update puzzle', description: result.error });
    setPending(false);
  };
  const enter = (value: number) => {
    if (selected == null || !data || data.attempt.content.puzzle[selected] !== 0 || data.attempt.status !== 'in_progress') return;
    act(noteMode && value > 0 ? { action: 'note', index: selected, value } : { action: 'set', index: selected, value });
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') { event.preventDefault(); enter(0); }
    if (event.key.toLowerCase() === 'n') setNoteMode(value => !value);
    if (selected != null && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -9 : 9;
      setSelected(Math.max(0, Math.min(80, selected + delta)));
    }
  };
  if (!data) return <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  const board = data.attempt.state?.board || data.attempt.content.puzzle;
  const notes = data.attempt.state?.notes || {};
  const related = (index: number) => selected != null && (Math.floor(index / 9) === Math.floor(selected / 9) || index % 9 === selected % 9 || (Math.floor(index / 27) === Math.floor(selected / 27) && Math.floor((index % 9) / 3) === Math.floor((selected % 9) / 3)));
  const conflict = (index: number) => {
    const value = board[index]; if (!value) return false;
    const row = Math.floor(index / 9), col = index % 9;
    return board.some((other, i) => i !== index && other === value && (Math.floor(i / 9) === row || i % 9 === col || (Math.floor(i / 27) === Math.floor(index / 27) && Math.floor((i % 9) / 3) === Math.floor(col / 3))));
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div><h1 className="text-3xl font-bold">Daily Sudoku</h1><p className="text-muted-foreground">Three shared puzzles every day. Mistakes add 30 seconds; hints add 60.</p></div>
      <div className="flex flex-wrap gap-2">{(['easy','medium','hard'] as Difficulty[]).map(level => <Button key={level} variant={difficulty === level ? 'default' : 'outline'} className="capitalize" onClick={() => setDifficulty(level)}>{level}</Button>)}</div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,1fr)]">
        <Card variant="glass">
          <CardHeader><CardTitle className="capitalize">{difficulty} Puzzle</CardTitle><CardDescription>{data.attempt.status === 'not_started' ? 'Start when you are ready; the timer continues after you leave.' : `${data.attempt.mistakes} mistakes · ${data.attempt.hints} hints`}</CardDescription></CardHeader>
          <CardContent>
            {data.attempt.status === 'not_started' ? <div className="py-16 text-center"><Button size="lg" onClick={() => act({ action: 'start' })}>Start {difficulty} Sudoku</Button></div> : <div className="space-y-4" onKeyDown={keyboard} tabIndex={-1}>
              <div className="mx-auto grid max-w-[36rem] grid-cols-9 overflow-hidden rounded-md border-2 border-foreground/70" role="grid" aria-label={`${difficulty} Sudoku board`}>
                {board.map((value, index) => {
                  const row = Math.floor(index / 9), col = index % 9, fixed = data.attempt.content.puzzle[index] !== 0;
                  return <button key={index} type="button" role="gridcell" aria-label={`Row ${row + 1}, column ${col + 1}${value ? `, ${value}` : ', empty'}`} onClick={() => setSelected(index)} className={cn(
                    'relative aspect-square border-border text-lg font-semibold sm:text-2xl focus:z-10 focus:outline-none focus:ring-2 focus:ring-primary',
                    col % 3 === 2 && col !== 8 && 'border-r-2 border-r-foreground/60', row % 3 === 2 && row !== 8 && 'border-b-2 border-b-foreground/60',
                    selected === index ? 'bg-primary/30' : related(index) ? 'bg-primary/10' : 'bg-background/30', fixed && 'font-black text-foreground', !fixed && value && 'text-primary', conflict(index) && 'bg-red-500/30 text-red-500'
                  )}>
                    {value || ''}
                    {!value && notes[index]?.length > 0 && <span className="absolute inset-0 grid grid-cols-3 p-0.5 text-[7px] font-normal text-muted-foreground sm:text-[9px]">{[1,2,3,4,5,6,7,8,9].map(n => <span key={n}>{notes[index].includes(n) ? n : ''}</span>)}</span>}
                  </button>;
                })}
              </div>
              {data.attempt.status === 'in_progress' ? <div className="space-y-3">
                <div className="grid grid-cols-9 gap-1">{[1,2,3,4,5,6,7,8,9].map(value => <Button key={value} variant="outline" className="px-0 text-lg" disabled={pending} onClick={() => enter(value)}>{value}</Button>)}</div>
                <div className="flex flex-wrap justify-center gap-2"><Button variant={noteMode ? 'default' : 'outline'} onClick={() => setNoteMode(value => !value)}><Pencil className="mr-2 h-4 w-4" />Notes</Button><Button variant="outline" onClick={() => enter(0)}><Eraser className="mr-2 h-4 w-4" />Clear</Button><Button variant="outline" disabled={pending} onClick={() => act({ action: 'hint' })}><Lightbulb className="mr-2 h-4 w-4" />Hint</Button></div>
              </div> : <div className="rounded-lg bg-muted/40 p-4 text-center"><p className="text-xl font-bold">Puzzle completed!</p><p>{formatDuration(data.attempt.durationMs)} + penalties = {formatDuration(data.attempt.score)}</p></div>}
            </div>}
          </CardContent>
        </Card>
        <DailyLeaderboard entries={data.leaderboard} game="sudoku" />
      </div>
    </div>
  );
}
