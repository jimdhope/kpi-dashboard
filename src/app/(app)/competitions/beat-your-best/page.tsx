'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Medal,
  TrendingUp,
  Info,
  Trophy,
  PenLine,
  Scale,
  Filter,
  Award,
  Download,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompetitionScoreRefresh } from '@/hooks/use-competition-score-refresh';

interface BybStanding {
  userId: string;
  name: string;
  rawPoints: number;
  rollingBest: number | null;
  ratio: number | null;
  rank: number | null;
  qualified: boolean;
  ranked: boolean;
}

interface BybPodChampion {
  podId: string;
  podName: string;
  userId: string;
  name: string;
  rawPoints: number;
  ratio: number | null;
}

type BybScope = 'competition' | 'campaign';

interface BybResponse {
  enabled: boolean;
  competition: { id: string; name: string };
  scope: BybScope;
  campaign: { id: string; name: string } | null;
  targetCompetitionIds: string[];
  pods: Array<{ id: string; name: string }>;
  podChampions: BybPodChampion[];
  standings: BybStanding[];
  topRawPoints: number;
}

interface CompetitionOption {
  id: string;
  name: string;
}

const ALL_PODS = 'all';

const getMedalColor = (rank: number) => {
  switch (rank) {
    case 1: return 'text-yellow-400';
    case 2: return 'text-gray-300';
    case 3: return 'text-orange-400';
    default: return 'text-muted-foreground';
  }
};

function StatusBadge({ standing }: { standing: BybStanding }) {
  if (!standing.ranked) {
    return <Badge variant="outline" className="text-[10px]">Unranked</Badge>;
  }
  if (standing.qualified) {
    return <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary">In contention</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">Below floor</Badge>;
}

function PersonalBestCard({
  standing,
  competitionId,
  isDownloading,
  onDownload,
}: {
  standing: BybStanding;
  competitionId: string;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  const label = standing.ratio !== null ? `${standing.ratio}%` : `${standing.rawPoints.toLocaleString()} pts`;
  return (
    <Card className="frosted-glass">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Personal Best Unlocked
            </p>
            <div className="mt-1 text-lg font-bold truncate">{standing.name}</div>
            <p className="text-xs text-muted-foreground">
              {label} of personal form
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onDownload}
            disabled={isDownloading}
            className="gap-1"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChampionCard({
  standing,
  competitionId,
  isDownloading,
  onDownload,
}: {
  standing: BybStanding;
  competitionId: string;
  isDownloading: boolean;
  onDownload: () => void;
}) {
  return (
    <Card className="frosted-glass">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Award className="h-4 w-4 text-yellow-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Weekly Champion
              </p>
            </div>
            <div className="mt-1 text-lg font-bold truncate">{standing.name}</div>
            <p className="text-xs text-muted-foreground">
              {standing.ratio !== null ? `${standing.ratio}%` : `${standing.rawPoints.toLocaleString()} pts`} improvement
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onDownload}
            disabled={isDownloading}
            className="gap-1"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BeatYourBestPage() {
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [scope, setScope] = useState<BybScope>('competition');
  const [selectedPodId, setSelectedPodId] = useState<string>(ALL_PODS);
  const [data, setData] = useState<BybResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'leaderboard' | 'certs'>('leaderboard');
  const [certFormat, setCertFormat] = useState<'svg' | 'png'>('png');
  const [downloadState, setDownloadState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchCompetitions() {
      try {
        const res = await fetch('/api/competitions');
        if (res.ok) {
          const body = await res.json();
          const list: CompetitionOption[] = body.competitions || [];
          setCompetitions(list);
          if (list.length > 0) setSelectedCompetitionId((current) => current || list[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    }
    fetchCompetitions();
  }, []);

  const fetchStandings = useCallback(async () => {
    if (!selectedCompetitionId) return;
    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      if (selectedPodId !== ALL_PODS) params.set('podIds', selectedPodId);
      const res = await fetch(`/api/competitions/${encodeURIComponent(selectedCompetitionId)}/beat-your-best?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error fetching Beat Your Best standings:', error);
    }
  }, [selectedCompetitionId, scope, selectedPodId]);

  useEffect(() => {
    void fetchStandings();
  }, [fetchStandings]);

  const effectiveScope: BybScope = data?.scope ?? scope;
  const subscriptionIds = React.useMemo(() => {
    if (!data) return selectedCompetitionId || null;
    if (effectiveScope !== 'campaign') return data.competition.id;
    return [...data.targetCompetitionIds.slice(-3), data.competition.id];
  }, [data, effectiveScope, selectedCompetitionId]);
  useCompetitionScoreRefresh(subscriptionIds, fetchStandings);

  const summary = useMemo(() => {
    if (!data) return null;
    const qualified = data.standings.filter((s) => s.qualified);
    return { leader: qualified[0] ?? null, contenders: qualified.length };
  }, [data]);

  const showChampions = Boolean(data && selectedPodId === ALL_PODS && data.podChampions.length > 0);

  // Certs tab: derive breakers + champion from standings
  const certBreakers = useMemo(() => {
    if (!data) return [];
    return data.standings
      .filter((s) => s.ranked && s.rollingBest !== null && s.rawPoints > s.rollingBest)
      .sort((a, b) => b.rawPoints - a.rawPoints);
  }, [data]);

  const certChampion = useMemo(() => {
    if (!data) return null;
    const qualified = data.standings.filter((s) => s.qualified);
    if (qualified.length === 0) return null;
    return qualified.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0];
  }, [data]);

  const isDownloadingCert = (userId: string) => downloadState[userId] ?? false;

  const downloadCert = async (userId: string, certType: 'personal-best' | 'top-improvement') => {
    setDownloadState((prev) => ({ ...prev, [userId]: true }));
    try {
      const standing = certChampion?.userId === userId
        ? certChampion!
        : certBreakers.find((s) => s.userId === userId)!;
      const url = `/api/competitions/${encodeURIComponent(selectedCompetitionId)}/beat-your-best/certificate?agentId=${standing.userId}&certType=${certType}&format=${certFormat}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch certificate');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `byb-${certType}-${standing.name.replace(/\s+/g, '-').toLowerCase()}.${certFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadState((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const downloadAllCerts = async () => {
    if (certBreakers.length === 0 && !certChampion) return;
    setDownloadState({});
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const date = new Date().toISOString().split('T')[0];

      const fetchPromises: Promise<void>[] = [];

      certBreakers.forEach((standing) => {
        fetchPromises.push(
          (async () => {
            const url = `/api/competitions/${encodeURIComponent(selectedCompetitionId)}/beat-your-best/certificate?agentId=${standing.userId}&certType=personal-best&format=${certFormat}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed for ${standing.name}`);
            const blob = await response.blob();
            zip.file(`byb-personal-best-${standing.name.replace(/\s+/g, '-').toLowerCase()}-${date}.${certFormat}`, blob);
          })(),
        );
      });

      if (certChampion) {
        fetchPromises.push(
          (async () => {
            const url = `/api/competitions/${encodeURIComponent(selectedCompetitionId)}/beat-your-best/certificate?agentId=${certChampion.userId}&certType=top-improvement&format=${certFormat}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed for ${certChampion.name}`);
            const blob = await response.blob();
            zip.file(`byb-top-improvement-${certChampion.name.replace(/\s+/g, '-').toLowerCase()}-${date}.${certFormat}`, blob);
          })(),
        );
      }

      await Promise.all(fetchPromises);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `byb-certificates-${date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download all failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Beat Your Best
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border border-amber-500/40">
              BETA
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            This week&apos;s points as a percentage of your best recent week.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {data?.campaign ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={effectiveScope === 'competition' ? 'secondary' : 'ghost'}
                onClick={() => setScope('competition')}
              >
                Competition
              </Button>
              <Button
                type="button"
                size="sm"
                variant={effectiveScope === 'campaign' ? 'secondary' : 'ghost'}
                onClick={() => setScope('campaign')}
              >
                Campaign
              </Button>
            </div>
          ) : null}
          <Select value={selectedPodId} onValueChange={setSelectedPodId} disabled={!data || data.pods.length === 0}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Pods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PODS}>All Pods</SelectItem>
              {data?.pods.map((pod) => (
                <SelectItem key={pod.id} value={pod.id}>
                  {pod.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCompetitionId} onValueChange={(value) => { setSelectedCompetitionId(value); setSelectedPodId(ALL_PODS); }}>
            <SelectTrigger className="w-[200px] md:w-[250px]">
              <SelectValue placeholder="Select competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((comp) => (
                <SelectItem key={comp.id} value={comp.id}>
                  {comp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab switcher */}
      {data && (
        <div className="flex gap-1 border-b border-border">
          <Button
            variant={tab === 'leaderboard' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('leaderboard')}
            className="gap-1"
          >
            <TrendingUp className="h-4 w-4" />
            Leaderboard
          </Button>
          <Button
            variant={tab === 'certs' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('certs')}
            className="gap-1"
          >
            <Award className="h-4 w-4" />
            Certificates
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !data ? (
        <Card className="frosted-glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            Unable to load Beat Your Best standings.
          </CardContent>
        </Card>
      ) : tab === 'certs' ? (
        /* ── Certificates Tab ────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Weekly Champion */}
          {certChampion ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-400" />
                  Weekly Champion
                </h2>
                <p className="text-sm text-muted-foreground">
                  Highest % improvement over personal best this week
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadCert(certChampion.userId, 'top-improvement')}
                disabled={isDownloadingCert(certChampion.userId)}
                className="gap-1"
              >
                {isDownloadingCert(certChampion.userId) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download Certificate
              </Button>
            </div>
          ) : (
            <Card className="frosted-glass">
              <CardContent className="py-8 text-center text-muted-foreground">
                No weekly champion this week — no qualified players have beaten their personal best yet.
              </CardContent>
            </Card>
          )}

          {/* Personal Bests Broken */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Personal Bests Broken
              </h2>
              <p className="text-sm text-muted-foreground">
                Agents who exceeded their rolling best this week
              </p>
            </div>
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              {(['png', 'svg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setCertFormat(fmt)}
                  className={`px-2.5 py-1 text-xs font-medium uppercase rounded transition-colors ${
                    certFormat === fmt
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
            {certBreakers.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={downloadAllCerts}
                disabled={certBreakers.some((s) => isDownloadingCert(s.userId))}
                className="gap-1"
              >
                {certBreakers.some((s) => isDownloadingCert(s.userId)) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download All ({certBreakers.length})
              </Button>
            )}
          </div>

          {certBreakers.length === 0 ? (
            <Card className="frosted-glass">
              <CardContent className="py-8 text-center text-muted-foreground">
                No personal bests broken this week yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certBreakers.map((standing) => (
                <PersonalBestCard
                  key={standing.userId}
                  standing={standing}
                  competitionId={data.competition.id}
                  isDownloading={isDownloadingCert(standing.userId)}
                  onDownload={() => downloadCert(standing.userId, 'personal-best')}
                />
              ))}
            </div>
          )}

          {certChampion && certBreakers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-400" />
                  Weekly Champion Certificate
                </h2>
                <p className="text-sm text-muted-foreground">
                  Download the champion certificate for {certChampion.name}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadCert(certChampion.userId, 'top-improvement')}
                disabled={isDownloadingCert(certChampion.userId)}
                className="gap-1"
              >
                {isDownloadingCert(certChampion.userId) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ── Leaderboard Tab ─────────────────────────────────────────── */
        <>
          <Card className="frosted-glass">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-primary" />
                How it works
              </CardTitle>
              <CardDescription>
                Everyone competes against their own recent form — not against the biggest scorer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: PenLine,
                    title: 'Score as usual',
                    text: 'Your points come from the same daily entries you already log — nothing extra to do.',
                  },
                  {
                    icon: Scale,
                    title: 'You vs your best',
                    text: 'Each week is scored as a % of your rolling best: the highest of your last 8 scoring weeks.',
                  },
                  {
                    icon: Filter,
                    title: 'Qualification floor',
                    text: "You need 3+ prior scoring weeks, and at least half of this week's top raw score.",
                  },
                  {
                    icon: Trophy,
                    title: 'Best ratio wins',
                    text: 'Highest percentage takes it — beating your own form matters more than raw volume.',
                  },
                ].map((step, index) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="frosted-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Leader</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold truncate">{summary?.leader?.name ?? '—'}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.leader ? `${summary.leader.ratio}% of personal form` : 'No qualified players yet'}
                </p>
              </CardContent>
            </Card>
            <Card className="frosted-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">In Contention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.contenders ?? 0}</div>
                <p className="text-xs text-muted-foreground">players above the qualification floor</p>
              </CardContent>
            </Card>
            <Card className="frosted-glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Raw Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.topRawPoints.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">floor is 50% of this ({Math.floor(data.topRawPoints / 2).toLocaleString()})</p>
              </CardContent>
            </Card>
          </div>

          {showChampions ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.podChampions.map((champion) => (
                <Card key={champion.podId} className="frosted-glass">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 shrink-0 text-yellow-400" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                        {champion.podName}
                      </p>
                    </div>
                    <div className="mt-1.5 text-lg font-bold truncate">{champion.name}</div>
                    <p className="text-xs text-muted-foreground">
                      Pod champion · {champion.ratio !== null ? `${champion.ratio}%` : `${champion.rawPoints.toLocaleString()} pts`}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <Card className="shadow-md frosted-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Standings —{' '}
                {effectiveScope === 'campaign' && data.campaign
                  ? data.campaign.name
                  : data.competition.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                {effectiveScope === 'campaign'
                  ? `Aggregated across ${data.targetCompetitionIds.length} competition${data.targetCompetitionIds.length === 1 ? '' : 's'} in this campaign. `
                  : ''}
                Rolling best = highest of your last 8 scoring weeks. Players need 3+ prior weeks to be ranked.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.standings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No scores logged yet this week.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Raw Points</TableHead>
                        <TableHead className="text-right">Rolling Best</TableHead>
                        <TableHead className="text-right">% of Best</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.standings.map((standing) => (
                        <TableRow key={standing.userId} className={cn(!standing.qualified && 'opacity-70')}>
                          <TableCell className="font-bold">
                            {standing.rank !== null && standing.rank <= 3 ? (
                              <Medal className={cn('h-5 w-5', getMedalColor(standing.rank))} />
                            ) : (
                              standing.rank ?? '—'
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{standing.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{standing.rawPoints.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {standing.rollingBest !== null ? standing.rollingBest.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {standing.ratio !== null ? `${standing.ratio}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge standing={standing} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
