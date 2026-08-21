'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { divisionLabel } from '@/lib/divisions';
import { useCompetitionScoreRefresh } from '@/hooks/use-competition-score-refresh';

interface CardRow {
  userId: string;
  userName: string | null;
  points: number;
  played: number;
  rank: number;
}

interface MyDivisionCardData {
  visible: boolean;
  podLeague: {
    leagueId: string;
    leagueName: string;
    cupName: string;
    divisionLabel: string;
    periodLabel: string;
    myRow: CardRow | null;
    topRows: CardRow[];
  } | null;
  campaignSummary: {
    leagueName: string;
    cupName: string;
    divisionLabel: string;
    position: number | null;
    of: number;
    points: number;
  } | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function DivisionCard({
  competitionId,
  currentUserId,
}: {
  competitionId: string | null;
  currentUserId?: string;
}) {
  const [data, setData] = useState<MyDivisionCardData | null>(null);

  const fetchCard = useCallback(async () => {
    try {
      const response = await fetch('/api/divisions/my-division');
      if (response.ok) setData(await response.json());
    } catch {
      // Feature card: failures stay silent.
    }
  }, []);

  useEffect(() => {
    void fetchCard();
  }, [fetchCard]);

  useCompetitionScoreRefresh(competitionId, fetchCard);

  if (!data?.visible) return null;

  return (
    <Link href="/divisions" className="block">
      <Card variant="glass" className="glass-card-hover cursor-pointer overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Trophy className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Divisions
                {data.podLeague && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-500/40 text-purple-600">
                    {divisionLabel(data.podLeague.divisionLabel)}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {data.podLeague ? `${data.podLeague.cupName} · ${data.podLeague.periodLabel}` : 'League tables'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!data.podLeague || data.podLeague.topRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No division standings yet.</p>
          ) : (
            <div className="space-y-0.5">
              {data.podLeague.topRows.map((row) => {
                const isCurrentUser = row.userId === currentUserId;
                return (
                  <div
                    key={row.userId}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded transition-colors',
                      isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/30',
                    )}
                  >
                    <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground">
                      {row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
                    </span>
                    <span className={cn('flex-1 min-w-0 truncate text-xs', isCurrentUser ? 'font-semibold text-primary' : 'font-medium')}>
                      {isCurrentUser ? 'You' : row.userName ?? 'Unknown'}
                    </span>
                    <span className={cn('text-xs font-bold tabular-nums', isCurrentUser ? 'text-primary' : '')}>
                      {row.points.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              {data.campaignSummary && (
                <>
                  <div className="border-t my-1" />
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-0.5">
                    Campaign — {data.campaignSummary.leagueName}
                  </p>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-purple-500/10 ring-1 ring-purple-500/30">
                    <span className="flex-1 min-w-0 truncate text-xs font-medium">
                      {divisionLabel(data.campaignSummary.divisionLabel)}
                      {data.campaignSummary.position !== null
                        ? ` · ${data.campaignSummary.position} of ${data.campaignSummary.of}`
                        : ''}
                    </span>
                    <span className="text-xs font-bold tabular-nums">
                      {data.campaignSummary.points.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
