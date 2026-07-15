import Link from 'next/link';
import { ArrowUpDown, Grid3X3, Swords, Type, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DailyLeaderboard, type DailyLeaderboardEntry } from '@/components/mini-games/daily-leaderboard';
import { authService } from '@/server/services/auth-service';
import { dailyGameService } from '@/server/services/daily-game-service';
import { rpsService } from '@/server/services/rps-service';

interface DailySummary { gameKey: string; variant: string; attempt: { status: string }; leaderboard: DailyLeaderboardEntry[] }

export default async function MiniGamesDashboard() {
  const user = await authService.requireCurrentUser();
  const [daily, rps] = await Promise.all([
    dailyGameService.summaries(user.id) as Promise<DailySummary[]>,
    rpsService.leaderboard() as Promise<DailyLeaderboardEntry[]>,
  ]);
  const cards = [
    { key: 'higher-lower:default', game: 'higher-lower' as const, title: 'Higher or Lower', description: 'One daily run. Build the longest streak.', href: '/mini-games/higher-lower', icon: ArrowUpDown, color: 'text-blue-500' },
    { key: 'daily-word:default', game: 'daily-word' as const, title: 'Daily Word', description: 'Find the five-letter word in six guesses.', href: '/mini-games/daily-word', icon: Type, color: 'text-green-500' },
    ...(['easy','medium','hard'] as const).map(level => ({ key: `sudoku:${level}`, game: 'sudoku' as const, title: `Sudoku · ${level[0].toUpperCase()}${level.slice(1)}`, description: 'Complete today’s shared 9×9 puzzle.', href: '/mini-games/sudoku', icon: Grid3X3, color: 'text-purple-500' })),
  ];
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Mini Games</h1><p className="text-muted-foreground">Daily challenges and top scores</p></div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      {cards.map(card => {
        const summary = daily.find(item => `${item.gameKey}:${item.variant}` === card.key);
        const Icon = card.icon;
        return <Card key={card.key} variant="glass" className="min-w-0 overflow-hidden">
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Icon className={`h-6 w-6 ${card.color}`} /><div><CardTitle>{card.title}</CardTitle><CardDescription>{card.description}</CardDescription></div></div><Button asChild size="sm"><Link href={card.href}>Play</Link></Button></div><p className="text-xs capitalize text-muted-foreground">Today: {summary?.attempt.status.replace('_', ' ') || 'not started'}</p></CardHeader>
          <CardContent><DailyLeaderboard entries={summary?.leaderboard || []} game={card.game} /></CardContent>
        </Card>;
      })}
      <Card variant="glass" className="min-w-0 overflow-hidden"><CardHeader><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Swords className="h-6 w-6 text-orange-500" /><div><CardTitle>Rock Paper Scissors</CardTitle><CardDescription>Unlimited classic matches</CardDescription></div></div><Button asChild size="sm"><Link href="/mini-games/rps">Play</Link></Button></div></CardHeader><CardContent>
        {rps.length === 0 ? <div className="py-8 text-center text-muted-foreground"><Trophy className="mx-auto mb-2 h-8 w-8 opacity-30" />No games played yet</div> : <div className="space-y-1">{rps.map(entry => <div key={entry.userId} className="flex px-3 py-2"><span className="w-8 font-bold">{entry.rank}</span><span className="flex-1">{entry.name}</span><span>{entry.score} wins</span></div>)}</div>}
      </CardContent></Card>
    </div>
  </div>;
}
