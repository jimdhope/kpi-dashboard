'use client';

import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface DailyLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  score: number;
  guesses?: number | null;
  durationMs?: number | null;
  mistakes?: number;
  hints?: number;
}

export function formatDuration(milliseconds?: number | null) {
  if (milliseconds == null) return '—';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
}

export function DailyLeaderboard({ entries, game }: { entries: DailyLeaderboardEntry[]; game: 'higher-lower' | 'daily-word' | 'sudoku' }) {
  const result = (entry: DailyLeaderboardEntry) => {
    if (game === 'higher-lower') return `${entry.score} streak`;
    if (game === 'daily-word') return `${entry.guesses} guesses · ${formatDuration(entry.durationMs)}`;
    return `${formatDuration(entry.score)} adjusted`;
  };
  return (
    <Card variant="glass">
      <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Today&apos;s Top 10</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? <p className="py-6 text-center text-muted-foreground">No completed attempts yet</p> : (
          <div className="space-y-1">
            {entries.map(entry => (
              <div key={entry.userId} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30">
                <span className="w-7 font-bold">{entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : entry.rank}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{result(entry)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
