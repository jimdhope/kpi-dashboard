'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Crown, ChevronDown, ChevronUp, Trophy, Users, Sparkles } from 'lucide-react';
import { divisionLabel } from '@/lib/divisions';

interface DivisionsSettings {
  enabled: boolean;
  teamsAnnouncementEnabled: boolean;
  dashboardCardEnabled: boolean;
  teamsWebhookIds: string[];
}

interface LeagueSummary {
  id: string;
  name: string;
  scopeType: string;
  scopeTargetId: string | null;
  cupName: string;
  blockStart: string;
  blockEnd: string;
  tierCount: number;
  tiers: string[];
  isActive: boolean;
  currentAssignmentCount: number;
}

interface SeedPreview {
  leagueId: string;
  cupName: string;
  lookbackCompetitions: number;
  tiers: Array<{
    division: string;
    players: Array<{ userId: string; userName: string | null; averagePoints: number | null; competitionsPlayed: number }>;
  }>;
}

interface ReshufflePlan {
  blockWinners: Array<{ division: string; userId: string; userName: string | null; points: number }>;
  promotions: Array<{ userId: string; userName: string | null; toDivision: string }>;
  relegations: Array<{ userId: string; userName: string | null; toDivision: string }>;
  protectedStays: Array<{ userId: string; userName: string | null; division: string }>;
}

interface RosterMember {
  userId: string;
  userName: string | null;
  division: string;
  isVirtual: boolean;
}

interface WebhookOption {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
}

const DEFAULT_CONFIG = {
  cupName: 'Autumn Cup',
  blockStart: '2026-09-01',
  blockEnd: '2026-12-31',
  promotionSlots: 2,
  relegationSlots: 2,
  absenceProtectionThreshold: 0.5,
  seedingLookbackCompetitions: 8,
};

export default function DivisionsSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<DivisionsSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookOption[]>([]);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);
  const [seedPreviews, setSeedPreviews] = useState<Record<string, SeedPreview>>({});
  const [reshufflePlans, setReshufflePlans] = useState<Record<string, ReshufflePlan>>({});
  const [rosters, setRosters] = useState<Record<string, RosterMember[]>>({});
  const [busyLeague, setBusyLeague] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pods, setPods] = useState<Array<{ id: string; name: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [newLeague, setNewLeague] = useState({
    name: '',
    scopeType: 'POD',
    podId: '',
    campaignId: '',
    tierCount: '3',
    ...DEFAULT_CONFIG,
  });

  const loadLeagues = useCallback(() => {
    fetch('/api/divisions/leagues')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((data: LeagueSummary[]) => setLeagues(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings/divisions')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load'))))
      .then((data: DivisionsSettings) => setSettings(data))
      .catch(() => toast({ variant: 'destructive', title: 'Could not load divisions settings' }));

    loadLeagues();

    fetch('/api/integrations/teams-webhooks')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((data: WebhookOption[]) => setWebhooks(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch('/api/pods')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((data) => setPods(Array.isArray(data) ? data : data.pods ?? []))
      .catch(() => {});

    fetch('/api/campaigns')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((data) => setCampaigns(Array.isArray(data) ? data : data.campaigns ?? []))
      .catch(() => {});
  }, [toast, loadLeagues]);

  const update = async (patch: Partial<DivisionsSettings>) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/divisions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error('Failed to save');
      const data: DivisionsSettings = await response.json();
      setSettings(data);
      toast({ title: 'Settings saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWebhook = (webhookId: string) => {
    if (!settings) return;
    const next = settings.teamsWebhookIds.includes(webhookId)
      ? settings.teamsWebhookIds.filter((id) => id !== webhookId)
      : [...settings.teamsWebhookIds, webhookId];
    void update({ teamsWebhookIds: next });
  };

  const act = async (leagueId: string, action: string, body?: unknown) => {
    setBusyLeague(leagueId);
    try {
      const response = await fetch(`/api/divisions/leagues/${leagueId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Action failed');
      return data;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: error instanceof Error ? error.message : 'Action failed',
      });
      return null;
    } finally {
      setBusyLeague(null);
    }
  };

  const previewSeed = async (leagueId: string) => {
    const preview = await act(leagueId, 'seed', { commit: false });
    if (preview) setSeedPreviews((previous) => ({ ...previous, [leagueId]: preview }));
  };

  const commitSeed = async (leagueId: string) => {
    const result = await act(leagueId, 'seed', { commit: true });
    if (result) {
      toast({ title: 'Divisions seeded' });
      setSeedPreviews((previous) => {
        const next = { ...previous };
        delete next[leagueId];
        return next;
      });
      loadLeagues();
    }
  };

  const previewReshuffle = async (leagueId: string) => {
    const plan = await act(leagueId, 'reshuffle', { commit: false });
    if (plan) setReshufflePlans((previous) => ({ ...previous, [leagueId]: plan }));
  };

  const commitReshuffle = async (leagueId: string) => {
    const result = await act(leagueId, 'reshuffle', { commit: true });
    if (result) {
      toast({ title: result.alreadyApplied ? 'Reshuffle was already applied' : 'Reshuffle applied' });
      setReshufflePlans((previous) => {
        const next = { ...previous };
        delete next[leagueId];
        return next;
      });
      loadLeagues();
    }
  };

  const recrown = async (leagueId: string, monthKey: string) => {
    const result = await act(leagueId, 'recrown', { monthKey: monthKey || undefined, force: true });
    if (result) toast({ title: `Crowned champions for ${result.periodLabel}` });
  };

  const movePlayer = async (leagueId: string, userId: string, division: string) => {
    const result = await act(leagueId, 'move-player', { userId, division });
    if (result) {
      toast({ title: 'Player moved' });
      loadRoster(leagueId);
    }
  };

  const loadRoster = useCallback((leagueId: string) => {
    fetch(`/api/divisions/leagues/${leagueId}/roster`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((data: { members: RosterMember[] }) =>
        setRosters((previous) => ({ ...previous, [leagueId]: data.members })),
      )
      .catch(() => {});
  }, []);

  const createLeague = async () => {
    setBusyLeague('__create__');
    try {
      const response = await fetch('/api/divisions/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLeague.name,
          scopeType: newLeague.scopeType,
          podId: newLeague.scopeType === 'POD' ? newLeague.podId || undefined : undefined,
          campaignId: newLeague.scopeType === 'CAMPAIGN' ? newLeague.campaignId || undefined : undefined,
          tierCount: Number(newLeague.tierCount),
          configJson: {
            cupName: newLeague.cupName,
            blockStart: newLeague.blockStart,
            blockEnd: newLeague.blockEnd,
            promotionSlots: Number(newLeague.promotionSlots),
            relegationSlots: Number(newLeague.relegationSlots),
            absenceProtectionThreshold: Number(newLeague.absenceProtectionThreshold),
            seedingLookbackCompetitions: Number(newLeague.seedingLookbackCompetitions),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not create league');
      toast({ title: 'League created' });
      setShowCreate(false);
      setNewLeague({ name: '', scopeType: 'POD', podId: '', campaignId: '', tierCount: '3', ...DEFAULT_CONFIG });
      loadLeagues();
    } catch (error) {
      toast({ variant: 'destructive', title: error instanceof Error ? error.message : 'Could not create league' });
    } finally {
      setBusyLeague(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          Divisions League
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/40">
            Beta
          </Badge>
        </h1>
        <p className="text-muted-foreground">
          League tables with promotion and relegation, monthly titles, and seasonal reshuffles.
          Every player stays in the competition — relegation only means starting the next block in the division below.
        </p>
      </div>

      {!settings ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Feature toggles
              </CardTitle>
              <CardDescription>Control where the divisions league appears across the app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Enable divisions</p>
                  <p className="text-xs text-muted-foreground">Master switch — everything ships dark until this is on.</p>
                </div>
                <Switch
                  checked={settings.enabled}
                  disabled={isSaving}
                  onCheckedChange={(checked) => void update({ enabled: checked })}
                  aria-label="Enable divisions"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Dashboard card</p>
                  <p className="text-xs text-muted-foreground">Show agents their division table on the agent dashboard.</p>
                </div>
                <Switch
                  checked={settings.dashboardCardEnabled}
                  disabled={isSaving || !settings.enabled}
                  onCheckedChange={(checked) => void update({ dashboardCardEnabled: checked })}
                  aria-label="Enable dashboard card"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Teams announcements</p>
                  <p className="text-xs text-muted-foreground">
                    Post monthly champions and reshuffle results to the selected Teams channels.
                  </p>
                </div>
                <Switch
                  checked={settings.teamsAnnouncementEnabled}
                  disabled={isSaving || !settings.enabled}
                  onCheckedChange={(checked) => void update({ teamsAnnouncementEnabled: checked })}
                  aria-label="Enable Teams announcements"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Teams channels</p>
                <p className="text-xs text-muted-foreground">
                  Pick the outgoing webhooks that receive announcements.
                </p>
                {webhooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No Teams webhooks found — add one under Integrations → Teams webhooks.
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {webhooks.map((webhook) => (
                      <label
                        key={webhook.id}
                        className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={settings.teamsWebhookIds.includes(webhook.id)}
                          onChange={() => toggleWebhook(webhook.id)}
                          disabled={isSaving || !settings.teamsAnnouncementEnabled}
                          className="h-4 w-4"
                        />
                        <span className="truncate">{webhook.name}</span>
                        {webhook.category && (
                          <Badge variant="outline" className="ml-auto text-[9px] shrink-0">
                            {webhook.category}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                Leagues
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCreate((value) => !value)}>
                <Sparkles className="mr-1 h-4 w-4" />
                New league
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {showCreate && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">League name</label>
                      <Input
                        value={newLeague.name}
                        onChange={(event) => setNewLeague({ ...newLeague, name: event.target.value })}
                        placeholder="e.g. Pod A League"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Scope</label>
                      <Select
                        value={newLeague.scopeType}
                        onValueChange={(value) => setNewLeague({ ...newLeague, scopeType: value })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POD">Pod league</SelectItem>
                          <SelectItem value="CAMPAIGN">Campaign league</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newLeague.scopeType === 'POD' ? (
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Pod</label>
                        <Select
                          value={newLeague.podId || 'none'}
                          onValueChange={(value) => setNewLeague({ ...newLeague, podId: value === 'none' ? '' : value })}
                        >
                          <SelectTrigger><SelectValue placeholder="Choose a pod" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— choose —</SelectItem>
                            {pods.map((pod) => (
                              <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Campaign</label>
                        <Select
                          value={newLeague.campaignId || 'none'}
                          onValueChange={(value) => setNewLeague({ ...newLeague, campaignId: value === 'none' ? '' : value })}
                        >
                          <SelectTrigger><SelectValue placeholder="Choose a campaign" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— choose —</SelectItem>
                            {campaigns.map((campaign) => (
                              <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Tiers</label>
                      <Select value={newLeague.tierCount} onValueChange={(value) => setNewLeague({ ...newLeague, tierCount: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 tiers</SelectItem>
                          <SelectItem value="3">3 tiers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Cup name</label>
                      <Input
                        value={newLeague.cupName}
                        onChange={(event) => setNewLeague({ ...newLeague, cupName: event.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Block start</label>
                        <Input
                          type="date"
                          value={newLeague.blockStart}
                          onChange={(event) => setNewLeague({ ...newLeague, blockStart: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Block end</label>
                        <Input
                          type="date"
                          value={newLeague.blockEnd}
                          onChange={(event) => setNewLeague({ ...newLeague, blockEnd: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void createLeague()}
                    disabled={busyLeague === '__create__' || !newLeague.name.trim()}
                  >
                    Create league
                  </Button>
                </div>
              )}

              {leagues.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No leagues have been created yet.</p>
                </div>
              ) : (
                leagues.map((league) => {
                  const isExpanded = expandedLeague === league.id;
                  const seedPreview = seedPreviews[league.id];
                  const plan = reshufflePlans[league.id];
                  const roster = rosters[league.id] ?? [];
                  return (
                    <div key={league.id} className="rounded-lg border bg-muted/30 p-4">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setExpandedLeague(isExpanded ? null : league.id);
                          if (!isExpanded && roster.length === 0) loadRoster(league.id);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex-1 font-medium">{league.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {league.scopeType === 'POD' ? 'Pod league' : 'Campaign league'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {league.tiers.map(divisionLabel).join(' → ')}
                          </Badge>
                          {!league.isActive && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-3 pl-1 border-t border-border/50 pt-3">
                          <div className="grid gap-2 sm:grid-cols-4 text-sm">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cup</p>
                              <p className="font-medium">{league.cupName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Block</p>
                              <p className="font-medium">{league.blockStart} → {league.blockEnd}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Assigned</p>
                              <p className="font-medium">{league.currentAssignmentCount}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                              <p className="font-medium">{league.isActive ? 'Active' : 'Inactive'}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {!seedPreview && (
                              <Button size="sm" variant="outline" disabled={busyLeague === league.id} onClick={() => void previewSeed(league.id)}>
                                Preview seed
                              </Button>
                            )}
                            {seedPreview && (
                              <Button size="sm" disabled={busyLeague === league.id} onClick={() => void commitSeed(league.id)}>
                                Confirm seed
                              </Button>
                            )}
                            {!plan && (
                              <Button size="sm" variant="outline" disabled={busyLeague === league.id} onClick={() => void previewReshuffle(league.id)}>
                                Preview reshuffle
                              </Button>
                            )}
                            {plan && (
                              <Button size="sm" disabled={busyLeague === league.id} onClick={() => void commitReshuffle(league.id)}>
                                Confirm reshuffle
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyLeague === league.id}
                              onClick={() => void recrown(league.id, '')}
                            >
                              Re-crown last month
                            </Button>
                          </div>

                          {seedPreview && (
                            <div className="rounded-md border p-3 space-y-2 text-xs">
                              <p className="font-medium">Proposed split (trailing form over last {seedPreview.lookbackCompetitions} competitions):</p>
                              {seedPreview.tiers.map((tier) => (
                                <div key={tier.division}>
                                  <p className="font-semibold">{divisionLabel(tier.division)}</p>
                                  <p className="text-muted-foreground">
                                    {tier.players
                                      .map((player) => `${player.userName ?? 'Unknown'}${player.averagePoints !== null ? ` (${player.averagePoints})` : ' (no history)'}`)
                                      .join(', ') || '—'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {plan && (
                            <div className="rounded-md border p-3 space-y-1.5 text-xs">
                              <p className="font-medium">Planned moves:</p>
                              {plan.blockWinners.map((winner) => (
                                <p key={`w-${winner.division}`}>
                                  🏆 {divisionLabel(winner.division)} champion: {winner.userName ?? 'Unknown'} ({winner.points} pts)
                                </p>
                              ))}
                              {plan.promotions.map((move) => (
                                <p key={`p-${move.userId}`} className="text-emerald-600">
                                  ⬆️ {move.userName ?? 'Unknown'} → {divisionLabel(move.toDivision)}
                                </p>
                              ))}
                              {plan.relegations.map((move) => (
                                <p key={`r-${move.userId}`} className="text-red-600">
                                  ⬇️ {move.userName ?? 'Unknown'} → {divisionLabel(move.toDivision)}
                                </p>
                              ))}
                              {plan.protectedStays.map((stay) => (
                                <p key={`s-${stay.userId}`} className="text-muted-foreground">
                                  🛡️ {stay.userName ?? 'Unknown'} protected in {divisionLabel(stay.division)}
                                </p>
                              ))}
                            </div>
                          )}

                          {roster.length > 0 && (
                            <div className="rounded-md border p-3 space-y-1.5 text-xs">
                              <p className="font-medium">Move player:</p>
                              {roster.map((member) => (
                                <div key={member.userId} className="flex items-center justify-between gap-2">
                                  <span className="truncate">
                                    {member.userName ?? 'Unknown'}
                                    <span className="ml-2 text-muted-foreground">{divisionLabel(member.division)}</span>
                                    {member.isVirtual && <span className="ml-1 text-[9px] uppercase">(unassigned)</span>}
                                  </span>
                                  <Select
                                    value={member.division}
                                    onValueChange={(value) => void movePlayer(league.id, member.userId, value)}
                                    disabled={busyLeague === league.id}
                                  >
                                    <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {league.tiers.map((tier) => (
                                        <SelectItem key={tier} value={tier}>{divisionLabel(tier)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
