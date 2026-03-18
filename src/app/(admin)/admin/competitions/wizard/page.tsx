'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';
import { format, addDays, startOfDay, isValid as isDateValid } from 'date-fns';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import {
  Popover as DialogPopover,
  PopoverContent as DialogPopoverContent,
  PopoverTrigger as DialogPopoverTrigger,
} from '@/components/ui/popover';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { RuleFormData } from '@/models/types';

interface CompetitionWithTeams extends Competition {
  teams?: Team[];
}

const DATE_FORMAT_DISPLAY = 'dd/MM/yyyy';

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface Rule extends RuleFormData {}

interface DailyTargetData {
  [ruleId: string]: {
    [dayOfWeek: string]: number | null;
  };
}

const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface CompetitionFormData {
  name: string;
  campaignId: string;
  podIds: string[];
  startDate: Date;
  endDate: Date;
  rules: Rule[];
}

function WizardContent({ competitionId }: { competitionId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditMode = !!competitionId;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<CompetitionFormData>({
    name: '',
    campaignId: '',
    podIds: [],
    startDate: new Date(),
    endDate: addDays(new Date(), 6),
    rules: [],
  });

  const [teams, setTeams] = useState<Team[]>([
    { id: 'team-1', name: 'Team 1', agentIds: [], emoji: '🏆' },
    { id: 'team-2', name: 'Team 2', agentIds: [], emoji: '🚀' },
    { id: 'team-3', name: 'Team 3', agentIds: [], emoji: '🔥' },
  ]);

  const [dailyTargets, setDailyTargets] = useState<DailyTargetData>({});
  const [activeTab, setActiveTab] = useState('basics');

  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
  const [openEmojiPickerId, setOpenEmojiPickerId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const fetchData = async () => {
      try {
        const campaignsQuery = query(collection(db, 'campaigns'), orderBy('name'));
        unsubscribes.push(
          onSnapshot(campaignsQuery, (snapshot) => {
            setCampaigns(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Campaign)));
          })
        );

        const podsQuery = query(collection(db, 'pods'), orderBy('name'));
        unsubscribes.push(
          onSnapshot(podsQuery, (snapshot) => {
            setPods(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Pod)));
          })
        );

        const usersQuery = query(collection(db, 'users'), orderBy('name'));
        unsubscribes.push(
          onSnapshot(usersQuery, (snapshot) => {
            setUsers(
              snapshot.docs.map((doc) => ({
                id: doc.id,
                uid: doc.data().uid || doc.id,
                ...doc.data(),
              } as AppUser))
            );
          })
        );

        if (competitionId) {
          const compDoc = await getDoc(doc(db, 'competitions', competitionId));
          if (compDoc.exists()) {
            const data = compDoc.data() as Competition;
            setFormData({
              name: data.name || '',
              campaignId: data.campaignId || '',
              podIds: data.podIds || [],
              startDate: data.startDate?.toDate?.() || new Date(),
              endDate: data.endDate?.toDate?.() || addDays(new Date(), 6),
              rules: data.rules || [],
            });

            const compData = data as CompetitionWithTeams;

            if (compData.teams && compData.teams.length > 0) {
              setTeams(compData.teams.map((t, i) => ({
                ...t,
                id: t.id || `team-${i + 1}`,
                agentIds: t.agentIds || [],
              })));
            }

            if (data.podIds && data.podIds.length > 0) {
              const targetsDoc = await getDoc(doc(db, 'dailyPodTargets', `${competitionId}_${data.podIds[0]}`));
              if (targetsDoc.exists()) {
                setDailyTargets(targetsDoc.data() as DailyTargetData);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load data' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [competitionId, toast]);

  const filteredPods = useMemo(() => {
    if (!formData.campaignId) return [];
    return pods.filter((pod) => pod.campaignId === formData.campaignId);
  }, [pods, formData.campaignId]);

  const selectedPodAgents = useMemo(() => {
    const agentIds = new Set<string>();
    teams.forEach((team) => {
      team.agentIds.forEach((id) => agentIds.add(id));
    });
    const unassigned: AppUser[] = [];
    
    filteredPods.forEach((pod) => {
      (pod.agentIds || []).forEach((userId) => {
        if (!agentIds.has(userId)) {
          const user = users.find((u) => u.id === userId);
          if (user) unassigned.push(user);
        }
      });
    });
    
    return unassigned;
  }, [filteredPods, teams, users]);

  const getTeamAgents = (teamId: string): AppUser[] => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return [];
    return team.agentIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is AppUser => !!u);
  };

  const handleAddRule = () => {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      name: '',
      emoji: '',
      points: 0,
      type: 'numeric',
    };
    setFormData((prev) => ({ ...prev, rules: [...prev.rules, newRule] }));
  };

  const handleUpdateRule = (index: number, updates: Partial<Rule>) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)),
    }));
  };

  const handleRemoveRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const handleAddTeam = () => {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: `Team ${teams.length + 1}`,
      agentIds: [],
      emoji: '🏆',
    };
    setTeams((prev) => [...prev, newTeam]);
  };

  const handleRemoveTeam = (teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const handleTeamEmojiChange = (teamId: string, emoji: EmojiClickData) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, emoji: emoji.emoji } : t))
    );
    setOpenEmojiPickerId(null);
  };

  const handleAssignAgent = (teamId: string, userId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return { ...t, agentIds: [...t.agentIds, userId] };
        }
        return t;
      })
    );
  };

  const handleUnassignAgent = (teamId: string, userId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return { ...t, agentIds: t.agentIds.filter((id) => id !== userId) };
        }
        return t;
      })
    );
  };

  const handleRandomAssignment = () => {
    const allAgents = [...selectedPodAgents];
    const shuffled = allAgents.sort(() => Math.random() - 0.5);
    
    const newTeams: Team[] = teams.map((t) => ({ ...t, agentIds: [] }));
    shuffled.forEach((agent, index) => {
      const agentId = agent.id;
      if (agentId) {
        newTeams[index % newTeams.length].agentIds.push(agentId);
      }
    });
    
    setTeams(newTeams);
    toast({ title: 'Agents Assigned', description: 'Agents have been randomly assigned to teams.' });
  };

  const handleTargetChange = (ruleId: string, day: string, value: string) => {
    const numericValue = value === '' ? null : parseInt(value, 10);
    if (value !== '' && (isNaN(numericValue!) || numericValue! < 0)) return;

    setDailyTargets((prev) => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || {}),
        [day]: numericValue,
      },
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Competition name is required' });
      return;
    }
    if (!formData.campaignId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a campaign' });
      return;
    }
    if (formData.podIds.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select at least one pod' });
      return;
    }
    if (formData.rules.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one rule' });
      return;
    }

    setIsSaving(true);
    try {
      const competitionData = {
        name: formData.name,
        campaignId: formData.campaignId,
        podIds: formData.podIds,
        startDate: Timestamp.fromDate(startOfDay(formData.startDate)),
        endDate: Timestamp.fromDate(startOfDay(formData.endDate)),
        rules: formData.rules.filter((r) => r.name.trim()),
        teams: teams.filter((t) => t.name.trim()),
      };

      if (isEditMode) {
        await updateDoc(doc(db, 'competitions', competitionId), competitionData);
        toast({ title: 'Competition Updated', description: 'Your changes have been saved.' });
      } else {
        const newCompRef = doc(collection(db, 'competitions'));
        await setDoc(newCompRef, competitionData);

        for (const podId of formData.podIds) {
          const targetsDocId = `${newCompRef.id}_${podId}`;
          await setDoc(doc(db, 'dailyPodTargets', targetsDocId), dailyTargets);
        }

        toast({ title: 'Competition Created', description: 'Your new competition has been saved.' });
      }

      router.push('/admin/competitions');
    } catch (error) {
      console.error('Error saving competition:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save competition' });
    } finally {
      setIsSaving(false);
    }
  };

  const canProceedToTeams = formData.name.trim() && formData.campaignId && formData.podIds.length > 0 && formData.rules.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Competition' : 'Create Competition'}</h1>
        <p className="text-muted-foreground">
          {isEditMode ? 'Update your competition settings and teams' : 'Set up your competition in just a few steps'}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basics" className="flex items-center gap-2">
            {activeTab === 'basics' ? <Check className="h-4 w-4" /> : <span>1</span>}
            <span>Basics</span>
          </TabsTrigger>
          <TabsTrigger value="teams" disabled={!canProceedToTeams} className="flex items-center gap-2">
            {canProceedToTeams && activeTab !== 'teams' ? (
              <Check className="h-4 w-4" />
            ) : activeTab === 'teams' ? (
              <Check className="h-4 w-4" />
            ) : (
              <span>2</span>
            )}
            <span>Teams</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Competition Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Competition Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekly Sprint - Q1 Week 5"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Campaign</Label>
                  <Select
                    value={formData.campaignId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, campaignId: value, podIds: [] }))
                    }
                    disabled={isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <div className="flex items-center gap-2">
                    <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(formData.startDate, 'PP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.startDate}
                          onSelect={(date) => {
                            if (date) {
                              setFormData((prev) => ({
                                ...prev,
                                startDate: date,
                                endDate: addDays(date, 6),
                              }));
                              setIsStartDatePopoverOpen(false);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="flex items-center gap-2">
                    <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(formData.endDate, 'PP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.endDate}
                          onSelect={(date) => {
                            if (date) {
                              setFormData((prev) => ({ ...prev, endDate: date }));
                              setIsEndDatePopoverOpen(false);
                            }
                          }}
                          disabled={(date) => formData.startDate && date < formData.startDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Participating Pods</Label>
                <ScrollArea className="h-40 w-full rounded-md border p-4">
                  {filteredPods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {formData.campaignId
                        ? 'No pods found in this campaign'
                        : 'Select a campaign first'}
                    </p>
                  ) : (
                    filteredPods.map((pod) => (
                      <div key={pod.id} className="flex items-center gap-2 mb-2">
                        <Checkbox
                          id={`pod-${pod.id}`}
                          checked={formData.podIds.includes(pod.id)}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              podIds: checked
                                ? [...prev.podIds, pod.id]
                                : prev.podIds.filter((id) => id !== pod.id),
                            }));
                          }}
                        />
                        <Label htmlFor={`pod-${pod.id}`} className="font-normal">
                          {pod.name}
                        </Label>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Achievements & Tasks</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={handleAddRule}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Define the achievements agents can log during this competition
              </p>
            </CardHeader>
            <CardContent>
              {formData.rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                  <p>No rules defined. Click &quot;Add Item&quot; to start.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="hidden md:grid md:grid-cols-12 gap-2 px-3 text-xs font-medium text-muted-foreground">
                    <div className="col-span-1">Emoji</div>
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Points</div>
                    <div className="col-span-2">Daily Target</div>
                    <div className="col-span-1"></div>
                  </div>

                  {formData.rules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start border p-3 rounded-md"
                    >
                      <div className="col-span-1">
                        <Input
                          placeholder="❓"
                          value={rule.emoji || ''}
                          onChange={(e) => handleUpdateRule(index, { emoji: e.target.value })}
                          maxLength={4}
                          className="h-9 text-center"
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          placeholder="Rule name"
                          value={rule.name}
                          onChange={(e) => handleUpdateRule(index, { name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={rule.type}
                          onValueChange={(value) =>
                            handleUpdateRule(index, { type: value as 'numeric' | 'checkbox' })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numeric">Numeric</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Pts"
                          value={rule.points || ''}
                          onChange={(e) =>
                            handleUpdateRule(index, { points: parseInt(e.target.value) || 0 })
                          }
                          disabled={rule.type === 'checkbox'}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        {rule.type === 'numeric' && rule.id && (
                          <Input
                            type="number"
                            placeholder="Daily"
                            value={dailyTargets[rule.id]?.mon ?? ''}
                            onChange={(e) => {
                              const ruleId = rule.id;
                              if (ruleId) handleTargetChange(ruleId, 'mon', e.target.value);
                            }}
                            className="h-9"
                          />
                        )}
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-9 w-9"
                          onClick={() => handleRemoveRule(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => canProceedToTeams && setActiveTab('teams')} disabled={!canProceedToTeams}>
              Next: Teams
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Competition Teams</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create teams and assign agents from selected pods
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleRandomAssignment}>
                    Random Assign
                  </Button>
                  <Button type="button" variant="outline" onClick={handleAddTeam}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Team
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">Unassigned ({selectedPodAgents.length})</CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[300px] p-4 pt-0">
                    <div className="space-y-2">
                      {selectedPodAgents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">All agents assigned.</p>
                      ) : (
                        selectedPodAgents.map((agent) => {
                          const agentId = agent.id;
                          return (
                            <div
                              key={agent.id}
                              className="p-2 text-sm bg-card rounded-md cursor-pointer hover:bg-accent"
                              onClick={() => {
                                if (teams.length > 0 && agentId) {
                                  handleAssignAgent(teams[0].id, agentId);
                                }
                              }}
                            >
                              {agent.name}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </Card>

                {teams.map((team) => (
                  <Card key={team.id}>
                    <CardHeader className="p-4 flex flex-row items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <DialogPopover
                          open={openEmojiPickerId === team.id}
                          onOpenChange={(isOpen) => setOpenEmojiPickerId(isOpen ? team.id : null)}
                        >
                          <DialogPopoverTrigger asChild>
                            <Button variant="outline" className="text-xl p-2 h-auto">
                              {team.emoji || '🏆'}
                            </Button>
                          </DialogPopoverTrigger>
                          <DialogPopoverContent className="w-auto p-0 border-0">
                            <EmojiPicker onEmojiClick={(emojiData) => handleTeamEmojiChange(team.id, emojiData)} />
                          </DialogPopoverContent>
                        </DialogPopover>
                        <div className="flex-1">
                          <Input
                            value={team.name}
                            onChange={(e) =>
                              setTeams((prev) =>
                                prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t))
                              )
                            }
                            className="font-semibold"
                          />
                          <p className="text-xs text-muted-foreground">{team.agentIds.length} Agents</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        onClick={() => handleRemoveTeam(team.id)}
                        disabled={teams.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <ScrollArea className="h-[250px] p-4 pt-0">
                      <div className="space-y-2">
                        {team.agentIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No agents assigned</p>
                        ) : (
                          getTeamAgents(team.id).map((agent) => {
                            const agentId = agent.id;
                            return (
                              <div
                                key={agent.id}
                                className="p-2 text-sm bg-card rounded-md flex items-center justify-between"
                              >
                                <span>{agent.name}</span>
                                {agentId && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleUnassignAgent(team.id, agentId)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setActiveTab('basics')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditMode ? 'Update Competition' : 'Create Competition'}
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CompetitionWizard() {
  const searchParams = useSearchParams();
  const competitionId = searchParams.get('edit') || undefined;
  
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-[400px] w-full" /></div>}>
      <WizardContent competitionId={competitionId} />
    </Suspense>
  );
}

  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
  const [openEmojiPickerId, setOpenEmojiPickerId] = useState<string | null>(null);
