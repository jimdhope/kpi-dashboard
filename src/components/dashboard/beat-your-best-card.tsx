'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompetitionScoreRefresh } from '@/hooks/use-competition-score-refresh';

const BYB_CARD_VIEW_KEY = 'byb-card-view';

type BybCardView = 'all' | 'mine';

interface BybStanding {
  userId: string;
  name: string;
  rawPoints: number;
  ratio: number | null;
  rank: number | null;
  qualified: boolean;
}

interface BybCardData {
  enabled: boolean;
  competition: { id: string; name: string };
  standings: BybStanding[];
}

export function BeatYourBestCard({
  competitionId,
  currentUserId,
  myPodId,
  myPodName,
}: {
  competitionId: string | null;
  currentUserId?: string;
  myPodId?: string | null;
  myPodName?: string | null;
}) {
  const [data, setData] = useState<BybCardData | null>(null);
  const [view, setView] = useState<BybCardView>('all');

  // Restore the persisted view once mounted; fall back if the pod vanished.
  useEffect(() => {
    const stored = window.localStorage.getItem(BYB_CARD_VIEW_KEY);
    setView(stored === 'mine' && myPodId ? 'mine' : 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveView: BybCardView = view === 'mine' && myPodId ? 'mine' : 'all';

  const fetchStandings = useCallback(async () => {
    if (!competitionId) return;
    try {
      const params = new URLSearchParams();
      if (effectiveView === 'mine' && myPodId) params.set('podIds', myPodId);
      const queryString = params.toString();
      const response = await fetch(
        `/api/competitions/${encodeURIComponent(competitionId)}/beat-your-best${queryString ? `?${queryString}` : ''}`,
      );
      if (response.ok) setData(await response.json());
    } catch {
      // Failures stay silent; SSE reconnects and visibility changes recover.
    }
  }, [competitionId, effectiveView, myPodId]);

  useEffect(() => {
    void fetchStandings();
  }, [fetchStandings]);

  useCompetitionScoreRefresh(competitionId, fetchStandings);

  const switchView = (next: BybCardView) => {
    setView(next);
    window.localStorage.setItem(BYB_CARD_VIEW_KEY, next);
  };

  if (!data?.enabled) return null;

  const topFive = data.standings.slice(0, 5);
  const ownRow = data.standings.find((standing) => standing.userId === currentUserId);
  const showOwnRow = ownRow && !topFive.some((standing) => standing.userId === ownRow.userId);

  return (
    <Link href="/competitions/beat-your-best" className="block">
      <Card variant="glass" className="glass-card-hover cursor-pointer overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Beat Your Best
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-600">BETA</Badge>
                </CardTitle>
                <CardDescription>
                  {effectiveView === 'mine' && myPodName ? myPodName : 'This week vs your personal best'}
                </CardDescription>
              </div>
            </div>
            {myPodId ? (
              <div
                className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <button
                  type="button"
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors',
                    effectiveView === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    switchView('all');
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors',
                    effectiveView === 'mine' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    switchView('mine');
                  }}
                >
                  My pod
                </button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {topFive.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No scores logged yet this week.</p>
          ) : (
            <div className="space-y-0.5">
              {topFive.map((standing) => {
                const isCurrentUser = standing.userId === currentUserId;
                return (
                  <div
                    key={standing.userId}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded transition-colors',
                      isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/30',
                    )}
                  >
                    <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground">
                      {standing.rank ?? '—'}
                    </span>
                    <span className={cn('flex-1 min-w-0 truncate text-xs', isCurrentUser ? 'font-semibold text-primary' : 'font-medium')}>
                      {isCurrentUser ? 'You' : standing.name}
                    </span>
                    <span className={cn('text-xs font-bold tabular-nums', isCurrentUser ? 'text-primary' : '')}>
                      {standing.ratio !== null ? `${standing.ratio}%` : `${standing.rawPoints.toLocaleString()} pts`}
                    </span>
                  </div>
                );
              })}
              {showOwnRow && ownRow && (
                <>
                  <div className="border-t my-1" />
                  <div className="flex items-center gap-2 p-1.5 rounded bg-primary/10 ring-1 ring-primary/30">
                    <span className="w-5 text-center text-[10px] font-bold tabular-nums text-muted-foreground">—</span>
                    <span className="flex-1 min-w-0 truncate text-xs font-semibold text-primary">You</span>
                    <span className="text-xs font-bold tabular-nums text-primary">
                      {ownRow.ratio !== null ? `${ownRow.ratio}%` : `${ownRow.rawPoints.toLocaleString()} pts`}
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
