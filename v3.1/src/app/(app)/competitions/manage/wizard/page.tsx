'use client';

import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  FileText,
  Upload,
  Copy,
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import {
  Popover as DialogPopover,
  PopoverContent as DialogPopoverContent,
  PopoverTrigger as DialogPopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
}

interface PodMember {
  id: string;
  name: string;
  email: string;
}

interface Pod {
  id: string;
  name: string;
  campaignId?: string;
  members?: PodMember[];
}

interface User {
  id: string;
  firebaseUid?: string | null;
  name: string;
  email: string;
}

interface Rule {
  id: string;
  name: string;
  emoji?: string;
  points: number;
  type: 'numeric' | 'checkbox';
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface DailyTargetData {
  [ruleId: string]: number;
}

interface CompetitionFormData {
  name: string;
  campaignId: string;
  podIds: string[];
  startDate: Date;
  endDate: Date;
  rules: Rule[];
}

interface CompetitionRuleTemplate {
  id: string;
  name: string;
  description?: string;
  rules: Array<{
    title: string;
    points: number;
    isCheckbox?: boolean;
    emoji?: string;
    dailyTarget?: number;
  }>;
}

function WizardContent({ competitionId, draftId }: { competitionId?: string; draftId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditMode = !!competitionId;
  const isDraftMode = !!draftId;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

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
  const [selectedAgentForTeam, setSelectedAgentForTeam] = useState<{ id: string; name: string } | null>(null);

  // Draft state
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Template state
  const [templates, setTemplates] = useState<CompetitionRuleTemplate[]>([]);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  // Load templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch('/api/competition-rule-templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
    loadTemplates();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [campaignsRes, podsRes, usersRes] = await Promise.all([
          fetch('/api/campaigns'),
          fetch('/api/pods'),
          fetch('/api/users'),
        ]);

        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          setCampaigns(data.campaigns || []);
        }

        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }

        // Load draft if draftId is provided
        if (draftId) {
          const draftRes = await fetch(`/api/competitions/drafts/${draftId}`);
          if (draftRes.ok) {
            const data = await draftRes.json();
            const draft = data.draft;
            if (draft) {
              const draftData = draft.draftData || {};
              setFormData({
                name: draftData.name || draft.name || '',
                campaignId: draftData.campaignId || '',
                podIds: draftData.podIds || [],
                startDate: draftData.startsAt ? new Date(draftData.startsAt) : new Date(),
                endDate: draftData.endsAt ? new Date(draftData.endsAt) : addDays(new Date(), 6),
                rules: (draftData.rules || []).map((r: any, i: number) => ({
                  id: r.id || `rule-${i}`,
                  name: r.name || r.title || '',
                  emoji: r.emoji || '',
                  points: r.points || 0,
                  type: r.isCheckbox ? 'checkbox' : 'numeric',
                })),
              });
              if (draftData.teams && draftData.teams.length > 0) {
                setTeams(draftData.teams.map((t: any, i: number) => ({
                  ...t,
                  id: t.id || `team-${i + 1}`,
                  agentIds: t.agentIds || [],
                })));
              }
              if (draftData.dailyTargets) {
                setDailyTargets(draftData.dailyTargets);
              }
              setLastSaved(draft.updatedAt ? new Date(draft.updatedAt) : null);
            }
          }
        }

        // Load competition if editing
        if (competitionId) {
          const compRes = await fetch(`/api/competitions/${competitionId}`);
          if (compRes.ok) {
            const data = await compRes.json();
            const comp = data.competition;
            if (comp) {
              setFormData({
                name: comp.name || '',
                campaignId: comp.campaignId || '',
                podIds: comp.podIds || [],
                startDate: comp.startsAt ? new Date(comp.startsAt) : new Date(),
                endDate: comp.endsAt ? new Date(comp.endsAt) : addDays(new Date(), 6),
                rules: (comp.rules || []).map((r: any) => ({
                  id: r.id,
                  name: r.title || r.name || '',
                  emoji: r.emoji || '',
                  points: r.points || 0,
                  type: r.isCheckbox ? 'checkbox' : 'numeric',
                })),
              });
              if (comp.teams && comp.teams.length > 0) {
                setTeams(comp.teams.map((t: any, i: number) => ({
                  ...t,
                  id: t.id || `team-${i + 1}`,
                  agentIds: t.agentIds || [],
                })));
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
    }

    fetchData();
  }, [competitionId, draftId, toast]);

  // Auto-save draft on step change
  useEffect(() => {
    if (!isLoading && !isEditMode && formData.name) {
      const autoSaveTimeout = setTimeout(() => {
        handleSaveDraft();
      }, 2000);
      return () => clearTimeout(autoSaveTimeout);
    }
  }, [formData, teams, activeTab, isLoading, isEditMode]);

  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    try {
      const draftData = {
        name: formData.name,
        campaignId: formData.campaignId,
        podIds: formData.podIds,
        rules: formData.rules.map(r => ({
          id: r.id,
          name: r.name,
          emoji: r.emoji,
          points: r.points,
          isCheckbox: r.type === 'checkbox',
          dailyTarget: dailyTargets[r.id],
        })),
        teams: teams.filter(t => t.name.trim()).map(t => ({
          id: t.id,
          name: t.name,
          agentIds: t.agentIds,
          emoji: t.emoji,
        })),
        dailyTargets,
        startsAt: formData.startDate.toISOString(),
        endsAt: formData.endDate.toISOString(),
      };

      if (currentDraftId) {
        // Update existing draft
        await fetch(`/api/competitions/drafts/${currentDraftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData),
        });
      } else {
        // Create new draft
        const res = await fetch('/api/competitions/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: '',
            draftData,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.draft?.id) {
            setCurrentDraftId(data.draft.id);
            // Update URL without refresh
            window.history.replaceState(null, '', `?draft=${data.draft.id}`);
          }
        }
      }
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSavingDraft(false);
    }
  }, [formData, teams, dailyTargets, activeTab, currentDraftId]);

  const handleApplyTemplate = (template: CompetitionRuleTemplate) => {
    const newRules = template.rules.map((rule, index) => ({
      id: `rule-${Date.now()}-${index}`,
      name: rule.title,
      emoji: rule.emoji || '',
      points: rule.points,
      type: rule.isCheckbox ? 'checkbox' as const : 'numeric' as const,
    }));
    setFormData((prev) => ({ ...prev, rules: newRules }));
    setIsTemplateDialogOpen(false);
    toast({ 
      title: 'Template Applied', 
      description: `Applied ${template.rules.length} rules from "${template.name}"` 
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) return;

    try {
      await fetch('/api/competition-rule-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          description: newTemplateDescription.trim(),
          rules: formData.rules.map(r => ({
            title: r.name,
            points: r.points,
            isCheckbox: r.type === 'checkbox',
            emoji: r.emoji,
            dailyTarget: dailyTargets[r.id],
          })),
        }),
      });
      setIsSaveTemplateDialogOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      toast({ title: 'Template Saved', description: 'Your template has been saved.' });
      
      // Reload templates
      const res = await fetch('/api/competition-rule-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save template.' });
    }
  };

  const filteredPods = useMemo(() => {
    if (!formData.campaignId) return [];
    return pods.filter((pod) => pod.campaignId === formData.campaignId);
  }, [pods, formData.campaignId]);

  const selectedPodAgents = useMemo(() => {
    // Collect Firebase UIDs of assigned agents
    const assignedFirebaseUids = new Set<string>();
    teams.forEach((team) => {
      team.agentIds.forEach((id) => assignedFirebaseUids.add(id));
    });
    const unassigned: User[] = [];
    
    const selectedPods = pods.filter(p => formData.podIds.includes(p.id));
    selectedPods.forEach((pod) => {
      (pod.members || []).forEach((member) => {
        // Find the user with matching database ID
        const user = users.find((u) => u.id === member.id);
        if (user) {
          // Check if this user's firebaseUid is NOT assigned to any team
          if (user.firebaseUid && !assignedFirebaseUids.has(user.firebaseUid)) {
            unassigned.push(user);
          } else if (!user.firebaseUid) {
            // If user has no firebaseUid, they can't be assigned to competition teams
            // so include them in unassigned for pod assignment purposes
            unassigned.push(user);
          }
        }
      });
    });
    
    return unassigned;
  }, [pods, formData.podIds, teams, users]);

  const getTeamAgents = (teamId: string): User[] => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return [];
    return team.agentIds
      .map((id) => users.find((u) => u.firebaseUid === id))
      .filter((u): u is User => !!u);
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
    shuffled.forEach((agent) => {
      const agentId = agent.id;
      if (agentId) {
        newTeams[Math.floor(Math.random() * newTeams.length)].agentIds.push(agentId);
      }
    });
    
    setTeams(newTeams);
    toast({ title: 'Agents Assigned', description: 'Agents have been randomly assigned to teams.' });
  };

  const handleTargetChange = (ruleId: string, value: string) => {
    const numericValue = value === '' ? 0 : parseInt(value, 10);
    if (value !== '' && (isNaN(numericValue) || numericValue < 0)) return;

    setDailyTargets((prev) => ({
      ...prev,
      [ruleId]: numericValue,
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

    // Validate that at least one rule has a name
    const validRules = formData.rules.filter((r) => r.name.trim());
    if (validRules.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'At least one rule must have a name' });
      return;
    }

    setIsSaving(true);
    try {
      const competitionData = {
        name: formData.name,
        campaignId: formData.campaignId,
        podIds: formData.podIds,
        startsAt: formData.startDate.toISOString(),
        endsAt: formData.endDate.toISOString(),
        rules: formData.rules.filter((r) => r.name.trim()).map(r => ({
          title: r.name,
          points: r.points,
          isCheckbox: r.type === 'checkbox',
          emoji: r.emoji || null,
          dailyTarget: dailyTargets[r.id] || null,
        })),
        teams: teams.filter((t) => t.name.trim()).map(t => ({
          name: t.name,
          agentIds: t.agentIds,
          emoji: t.emoji || null,
        })),
      };

      if (isEditMode) {
        const res = await fetch(`/api/competitions/${competitionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(competitionData),
        });

        if (res.ok) {
          toast({ title: 'Competition Updated', description: 'Your changes have been saved.' });
          router.push('/competitions/manage');
        } else {
          const error = await res.json().catch(() => ({ message: 'Failed to save competition' }));
          toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save competition' });
        }
      } else {
        // Publish from draft
        if (currentDraftId) {
          const res = await fetch(`/api/competitions/drafts/${currentDraftId}/publish`, {
            method: 'POST',
          });
          if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to publish competition' }));
            throw new Error(error.message || 'Failed to publish competition');
          }
        } else {
          // Create competition directly
          const res = await fetch('/api/competitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(competitionData),
          });
          if (!res.ok) {
            const error = await res.json().catch(() => ({ message: 'Failed to create competition' }));
            throw new Error(error.message || 'Failed to create competition');
          }
        }
        toast({ title: 'Competition Created', description: 'Your new competition has been saved.' });
        router.push('/competitions/manage');
      }
    } catch (error) {
      console.error('Error saving competition:', error);
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to save competition' });
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
      {/* Draft Status Bar */}
      {currentDraftId && !isEditMode && (
        <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 text-sm text-primary">
            <FileText className="h-4 w-4" />
            <span>Draft saved{lastSaved && ` • Last saved ${format(lastSaved, 'h:mm a')}`}</span>
          </div>
          {isSavingDraft && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </div>
          )}
        </div>
      )}

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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Achievements & Tasks</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Define the achievements agents can log during this competition
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsTemplateDialogOpen(true)}
                    className="gap-1"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Load Template</span>
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsSaveTemplateDialogOpen(true)}
                    disabled={formData.rules.length === 0}
                    className="gap-1"
                  >
                    <Save className="h-4 w-4" />
                    <span className="hidden sm:inline">Save as Template</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddRule} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>
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
                            value={dailyTargets[rule.id] ?? ''}
                            onChange={(e) => {
                              const ruleId = rule.id;
                              if (ruleId) handleTargetChange(ruleId, e.target.value);
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
            <CardContent className="space-y-6">
              <Card className="bg-muted/30">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Unassigned ({selectedPodAgents.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {selectedPodAgents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">All agents assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedPodAgents.map((agent) => {
                        const agentId = agent.id;
                        return (
                          <div
                            key={agent.id}
                            className="px-3 py-1.5 text-sm bg-card rounded-full cursor-pointer hover:bg-accent border"
                            onClick={() => {
                              if (agentId && agent.name) {
                                setSelectedAgentForTeam({ id: agentId, name: agent.name });
                              }
                            }}
                          >
                            {agent.name}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <Link href="/competitions/manage">
              <Button type="button" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              {!isEditMode && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSaving || !formData.name.trim()}
                  className="gap-1"
                >
                  {isSavingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Draft
                </Button>
              )}
              <Button onClick={handleSave} disabled={isSaving} className="gap-1">
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
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAgentForTeam} onOpenChange={() => setSelectedAgentForTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Team</DialogTitle>
            <DialogDescription>
              Choose which team to assign {selectedAgentForTeam?.name} to:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {teams.map((team) => (
              <Button
                key={team.id}
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => {
                  if (selectedAgentForTeam?.id) {
                    handleAssignAgent(team.id, selectedAgentForTeam.id);
                    setSelectedAgentForTeam(null);
                  }
                }}
              >
                <span className="mr-2 text-lg">{team.emoji || '🏆'}</span>
                {team.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {team.agentIds.length} members
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Load Rule Template
            </DialogTitle>
            <DialogDescription>
              Select a template to load predefined rules
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No templates saved yet</p>
                <p className="text-sm">Create rules and save them as a template to reuse them</p>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{template.name}</h4>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {template.rules.length} rules
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {template.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.rules.slice(0, 4).map((rule, index) => (
                          <span key={index} className="text-xs bg-muted px-2 py-0.5 rounded">
                            {rule.emoji || '📋'} {rule.title}
                          </span>
                        ))}
                        {template.rules.length > 4 && (
                          <span className="text-xs text-muted-foreground">
                            +{template.rules.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleApplyTemplate(template)} className="shrink-0 gap-1">
                      <Copy className="h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={isSaveTemplateDialogOpen} onOpenChange={setIsSaveTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Save as Template
            </DialogTitle>
            <DialogDescription>
              Save the current rules as a reusable template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                placeholder="e.g., Weekly Sprint Rules"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDescription">Description (optional)</Label>
              <Input
                id="templateDescription"
                placeholder="Describe when to use this template"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rules to save ({formData.rules.length})</Label>
              <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto">
                {formData.rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2 py-1">
                    <span className="text-lg">{rule.emoji || '📋'}</span>
                    <span className="flex-1 truncate">{rule.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {rule.points} pts • {rule.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsTemplate} disabled={!newTemplateName.trim()}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WizardPageContent({ competitionId, draftId }: { competitionId?: string; draftId?: string }) {
  return <WizardContent competitionId={competitionId} draftId={draftId} />;
}

export default function CompetitionWizard() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-[400px] w-full" /></div>}>
      <WizardPageContentWrapper />
    </Suspense>
  );
}

function WizardPageContentWrapper() {
  const searchParams = useSearchParams();
  const competitionId = searchParams.get('edit') || undefined;
  const draftId = searchParams.get('draft') || undefined;
  return <WizardPageContent competitionId={competitionId} draftId={draftId} />;
}
