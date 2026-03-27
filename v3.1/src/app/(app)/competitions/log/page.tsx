'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Loader2, Send, Filter, Minus, Plus } from 'lucide-react';
import { format, startOfDay, getDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Pod {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  podId?: string | null;
  podIds?: string[];
  roles: string[];
}

interface Competition {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  podIds: string[];
  rules: Array<{
    id: string;
    title: string;
    points: number;
    isCheckbox?: boolean;
    emoji?: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
  }>;
}

interface Achievement {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  ruleName?: string | null;
  value: number;
  points: number;
  date: string;
  status?: string;
}

interface TeamBonusLog {
  id: string;
  teamId: string;
  points: number;
  date: string;
}

interface AchievementInputState extends Record<string, any> {}

interface TaskInputState {
  [agentId: string]: {
    [ruleId: string]: {
      checked: boolean;
      existingLogId?: string;
    };
  };
}

interface TeamBonusInputState {
  [teamId: string]: {
    points: number;
    existingLogId?: string;
  };
}

const LOG_ACHIEVEMENTS_POD_KEY = 'logAchievementsPage_selectedPodId';

const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function LogScoresPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [agents, setAgents] = useState<User[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievementInputs, setAchievementInputs] = useState<AchievementInputState>({});
  const [taskInputs, setTaskInputs] = useState<TaskInputState>({});
  const [bonusInputs, setBonusInputs] = useState<TeamBonusInputState>({});

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [bonusLogs, setBonusLogs] = useState<TeamBonusLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<{ [key: string]: boolean }>({});
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);
  const [activeCompetitionName, setActiveCompetitionName] = useState<string>('');

  const competitionRules = useMemo(() => {
    const comp = competitions.find(c => c.id === activeCompetitionId);
    return comp?.rules || [];
  }, [competitions, activeCompetitionId]);

  const teams = useMemo(() => {
    const comp = competitions.find(c => c.id === activeCompetitionId);
    return comp?.teams || [];
  }, [competitions, activeCompetitionId]);

  useEffect(() => {
    const savedPodId = localStorage.getItem(LOG_ACHIEVEMENTS_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
  }, []);

  const handleSelectedPodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(LOG_ACHIEVEMENTS_POD_KEY, podId);
  };

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      try {
        const [podsRes, usersRes, compsRes] = await Promise.all([
          fetch('/api/pods'),
          fetch('/api/users'),
          fetch('/api/competitions'),
        ]);

        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setAgents((data.users || []).filter((u: User) => u.roles?.includes('agent')));
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.user?.id || null);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    }
    fetchMe();
  }, []);

  useEffect(() => {
    if (!selectedPodId) {
      setActiveCompetitionId(null);
      setActiveCompetitionName('');
      return;
    }

    const dateForQuery = startOfDay(selectedDate);

    const matchingComp = competitions.find(comp => {
      if (!comp.podIds?.includes(selectedPodId)) return false;
      const startDate = comp.startsAt ? new Date(comp.startsAt) : null;
      const endDate = comp.endsAt ? new Date(comp.endsAt) : null;
      if (!startDate || !endDate) return false;
      return dateForQuery >= startDate && dateForQuery <= endDate;
    });

    setActiveCompetitionId(matchingComp?.id || null);
    setActiveCompetitionName(matchingComp?.name || '');
  }, [selectedPodId, selectedDate, competitions]);

  useEffect(() => {
    if (!activeCompetitionId || !selectedPodId) {
      setAchievements([]);
      setBonusLogs([]);
      setAchievementInputs({});
      setTaskInputs({});
      setBonusInputs({});
      return;
    }

    async function fetchDailyData() {
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const [achievementsRes, bonusRes] = await Promise.all([
          fetch(`/api/achievements?competitionId=${activeCompetitionId}&podId=${selectedPodId}&date=${dateStr}`),
          fetch(`/api/bonus-logs?competitionId=${activeCompetitionId}&date=${dateStr}`),
        ]);

        if (achievementsRes.ok) {
          const data = await achievementsRes.json();
          setAchievements(data.achievements || []);
        }
        if (bonusRes.ok) {
          const data = await bonusRes.json();
          setBonusLogs(data.bonusLogs || []);
        }
      } catch (err) {
        console.error('Error fetching daily data:', err);
      }
    }

    fetchDailyData();
  }, [activeCompetitionId, selectedPodId, selectedDate]);

  useEffect(() => {
    const podAgents = agents.filter(a => a.podIds?.includes(selectedPodId));
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Improved date filtering to match ISO strings from API
    // We use a robust matching that doesn't care about time components
    const todayAchievements = achievements.filter(a => {
      if (!a.date) return false;
      const dateObj = new Date(a.date);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const aDateStr = `${year}-${month}-${day}`;
      return aDateStr === dateStr;
    });

    const initialInputs: AchievementInputState = {};
    podAgents.forEach(agent => {
      if (!agent.id) return;
      initialInputs[agent.id] = {};
      const agentLogs = todayAchievements.filter(log => log.agentId === agent.id);
      const naLog = agentLogs.find(log => log.ruleId === 'na');
      initialInputs[agent.id].isPresent = !naLog;
      initialInputs[agent.id].naLogId = naLog?.id;
      competitionRules.forEach(rule => {
        if (!rule.id || rule.isCheckbox) return;
        // Match by ruleName since imported achievements use V2 rule IDs
        const existingLog = agentLogs.find(log => log.ruleName === rule.title);
        initialInputs[agent.id][rule.id] = { 
          value: existingLog ? String(existingLog.value) : '0', 
          existingLogId: existingLog?.id 
        };
      });
    });
    setAchievementInputs(initialInputs);

    const initialTaskInputs: TaskInputState = {};
    podAgents.forEach(agent => {
      if (!agent.id) return;
      initialTaskInputs[agent.id] = {};
      competitionRules.forEach(rule => {
        if (!rule.id || !rule.isCheckbox) return;
        // Match by ruleName since imported achievements use V2 rule IDs
        const existingLog = todayAchievements.find(log => log.agentId === agent.id && log.ruleName === rule.title);
        initialTaskInputs[agent.id][rule.id] = { checked: !!existingLog, existingLogId: existingLog?.id };
      });
    });
    setTaskInputs(initialTaskInputs);

    const initialBonusInputs: TeamBonusInputState = {};
    teams.forEach(team => {
      const existingLog = bonusLogs.find(log => {
        if (!log.date) return false;
        const dateObj = new Date(log.date);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const logDateStr = `${year}-${month}-${day}`;
        return log.teamId === team.id && logDateStr === dateStr;
      });
      initialBonusInputs[team.id] = { points: existingLog ? existingLog.points : 0, existingLogId: existingLog?.id };
    });
    setBonusInputs(initialBonusInputs);
  }, [achievements, bonusLogs, agents, selectedPodId, selectedDate, competitionRules, teams]);

  const handleSaveAchievement = useCallback(async (agentId: string, ruleId: string, value: string) => {
    if (!selectedPodId || !currentUserId || !activeCompetitionId) return;

    const rule = competitionRules.find(r => r.id === ruleId);
    if (!rule || !rule.id) return;

    const numericValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numericValue) || numericValue < 0) return;

    const points = numericValue * (rule.points || 0);
    const savingKey = `${agentId}-${ruleId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingId = achievementInputs[agentId]?.[ruleId]?.existingLogId;

      if (numericValue === 0 && existingId) {
        await fetch(`/api/achievements/${existingId}`, { method: 'DELETE' });
        setAchievementInputs(prev => {
          const newState = { ...prev };
          if (newState[agentId] && newState[agentId][ruleId]) {
            delete newState[agentId][ruleId].existingLogId;
            newState[agentId][ruleId].value = '0';
          }
          return newState;
        });
      } else if (numericValue > 0) {
        const res = await fetch('/api/achievements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitionId: activeCompetitionId,
            agentId,
            podId: selectedPodId,
            ruleId: rule.id,
            ruleName: rule.title,
            value: numericValue,
            points,
            date: dateStr,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const savedId = data.achievement?.id;
          
          setAchievementInputs(prev => {
            const newState = { ...prev };
            if (!newState[agentId]) newState[agentId] = {};
            newState[agentId][ruleId] = { 
              value: String(numericValue),
              existingLogId: savedId 
            };
            return newState;
          });
        }
      }
    } catch (err) {
      console.error('Error saving achievement:', err);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save achievement.' });
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  }, [selectedPodId, currentUserId, activeCompetitionId, competitionRules, selectedDate, achievementInputs, toast]);

  const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement]);

  const handleInputChange = useCallback((agentId: string, ruleId: string, newValue: string) => {
    if (newValue !== '' && (!/^\d*$/.test(newValue))) return;

    setAchievementInputs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [ruleId]: {
          ...(prev[agentId]?.[ruleId] || { value: '0' }),
          value: newValue,
        },
      },
    }));
    debouncedSave(agentId, ruleId, newValue);
  }, [debouncedSave]);

  const handleIncrement = useCallback((agentId: string, ruleId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    handleInputChange(agentId, ruleId, String(numericValue + 1));
  }, [handleInputChange]);

  const handleDecrement = useCallback((agentId: string, ruleId: string, currentValue: string) => {
    const numericValue = parseInt(currentValue, 10) || 0;
    if (numericValue > 0) {
      handleInputChange(agentId, ruleId, String(numericValue - 1));
    }
  }, [handleInputChange]);

  const handlePresenceChange = async (agentId: string, isPresent: boolean) => {
    if (!selectedPodId || !currentUserId || !activeCompetitionId) return;

    const savingKey = `${agentId}-na`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const naLogId = achievementInputs[agentId]?.naLogId;

      if (!isPresent) {
        if (naLogId) {
          await fetch(`/api/achievements/${naLogId}`, { method: 'DELETE' });
        }
        const res = await fetch('/api/achievements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitionId: activeCompetitionId,
            agentId,
            podId: selectedPodId,
            ruleId: 'na',
            ruleName: 'N/A',
            value: 0,
            points: 0,
            date: dateStr,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setAchievementInputs(prev => ({
            ...prev,
            [agentId]: { ...(prev[agentId] || {}), isPresent, naLogId: data.achievement?.id }
          }));
        }
      } else if (naLogId) {
        await fetch(`/api/achievements/${naLogId}`, { method: 'DELETE' });
        setAchievementInputs(prev => ({
          ...prev,
          [agentId]: { ...(prev[agentId] || {}), isPresent, naLogId: undefined }
        }));
      }
    } catch (error) {
      console.error('Error changing presence status:', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update presence status.' });
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleTaskChange = async (agentId: string, ruleId: string, isChecked: boolean) => {
    if (!selectedPodId || !currentUserId || !activeCompetitionId) return;

    const savingKey = `task-${agentId}-${ruleId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));

    setTaskInputs(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], checked: isChecked } },
    }));

    try {
      const rule = competitionRules.find(r => r.id === ruleId);
      if (!rule) return;

      const existingId = taskInputs[agentId]?.[ruleId]?.existingLogId;
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      if (isChecked && !existingId) {
        const res = await fetch('/api/achievements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitionId: activeCompetitionId,
            agentId,
            podId: selectedPodId,
            ruleId: rule.id,
            ruleName: rule.title,
            value: 1,
            points: rule.points,
            date: dateStr,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTaskInputs(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], existingLogId: data.achievement?.id } },
          }));
        }
      } else if (!isChecked && existingId) {
        await fetch(`/api/achievements/${existingId}`, { method: 'DELETE' });
        setTaskInputs(prev => ({
          ...prev,
          [agentId]: { ...prev[agentId], [ruleId]: { ...prev[agentId]?.[ruleId], existingLogId: undefined } },
        }));
      }
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ variant: 'destructive', title: 'Task Save Failed', description: 'Could not save task.' });
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleBonusPointsChange = useCallback(async (teamId: string, change: number) => {
    if (!selectedPodId || !currentUserId || !activeCompetitionId) return;

    const currentPoints = bonusInputs[teamId]?.points ?? 0;
    const newPoints = currentPoints + change;
    const existingLogId = bonusInputs[teamId]?.existingLogId;

    setIsSavingBonus(true);
    setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], points: newPoints } }));

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      if (newPoints === 0 && existingLogId) {
        await fetch(`/api/bonus-logs/${existingLogId}`, { method: 'DELETE' });
        setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], existingLogId: undefined } }));
      } else if (newPoints !== 0) {
        const res = await fetch('/api/bonus-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitionId: activeCompetitionId,
            teamId,
            podId: selectedPodId,
            points: newPoints,
            reason: 'Manual Adjustment',
            date: dateStr,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], existingLogId: data.bonusLog?.id } }));
        }
      }
    } catch (error) {
      console.error('Error saving bonus:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save bonus points.' });
      setBonusInputs(prev => ({ ...prev, [teamId]: { ...prev[teamId], points: currentPoints } }));
    } finally {
      setIsSavingBonus(false);
    }
  }, [bonusInputs, selectedPodId, currentUserId, activeCompetitionId, selectedDate, toast]);

  const podAgents = agents.filter(a => a.podIds?.includes(selectedPodId));
  const canLog = selectedPodId && podAgents.length > 0 && competitionRules.length > 0;
  const numericRules = useMemo(() => competitionRules.filter(r => !r.isCheckbox), [competitionRules]);
  const checkboxRules = useMemo(() => competitionRules.filter(r => r.isCheckbox), [competitionRules]);

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="grid gap-2">
                <Label htmlFor="pod-select">Pod</Label>
                <Select onValueChange={handleSelectedPodChange} value={selectedPodId} disabled={isLoading}>
                  <SelectTrigger id="pod-select" className="w-[200px]">
                    <SelectValue placeholder={isLoading ? "Loading..." : "Select Pod"} />
                  </SelectTrigger>
                  <SelectContent>
                    {pods.map(pod => (
                      <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-select">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="date-select" variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0 z-50">
                    <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(startOfDay(date))} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {activeCompetitionName && (
              <div className="text-sm text-muted-foreground">
                Active Competition: <span className="font-medium">{activeCompetitionName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle>Log Daily Achievements</CardTitle>
            <CardDescription>Select a pod and date, then enter achievements for each agent.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedPodId ? (
              <div className="p-6">
                <p className="text-muted-foreground text-center">Please select a pod to log achievements.</p>
              </div>
            ) : isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !canLog ? (
              <div className="p-6">
                <p className="text-muted-foreground text-center py-6">
                  {podAgents.length === 0 ? "No agents found in this pod." : "No competition rules found."}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-auto max-h-[calc(100vh-380px)]">
                {/* Header Row - Sticky */}
                <div 
                  className="sticky top-0 z-50 flex bg-muted/95 backdrop-blur-sm border-b-2 border-muted"
                  style={{ minWidth: `${200 + competitionRules.length * 120}px` }}
                >
                  <div className="sticky left-0 z-[60] w-[200px] shrink-0 bg-muted/95 border-r-2 border-muted shadow-[4px_0_4px_-2px_rgba(0,0,0,0.15)]">
                    <div className="p-3 font-bold text-foreground">Agent</div>
                  </div>
                  {competitionRules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className="w-[120px] shrink-0 p-2 text-center border-r border-muted/50"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">{rule.emoji || '📋'}</span>
                        <span className="text-xs font-bold uppercase tracking-wider">{rule.title}</span>
                        <span className="text-[10px] text-muted-foreground">{rule.points} pts</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agent Rows */}
                {podAgents.map(agent => {
                  const isPresent = achievementInputs[agent.id!]?.isPresent !== false;
                  const isAbsent = !isPresent;
                  
                  return (
                    <div 
                      key={agent.id}
                      className={cn(
                        "flex border-b border-muted",
                        isAbsent && "opacity-60 bg-muted/30"
                      )}
                      style={{ minWidth: `${200 + competitionRules.length * 120}px` }}
                    >
                      {/* Agent Name - Sticky Left */}
                      <div className={cn(
                        "sticky left-0 z-30 w-[200px] shrink-0 font-semibold border-r-2 border-muted shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]",
                        isAbsent ? "bg-muted/50" : "bg-background"
                      )}>
                        <div className="flex items-center gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => handlePresenceChange(agent.id!, !isPresent)}
                            className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                              isPresent ? "border-green-500 bg-green-500/10 text-green-600" : "border-muted-foreground/50",
                              isSaving[`${agent.id}-na`] && "opacity-50"
                            )}
                          >
                            {isPresent && <span className="text-xs">✓</span>}
                          </button>
                          <span className={cn("truncate max-w-[140px]", !isPresent && "line-through text-muted-foreground")}>
                            {agent.name}
                          </span>
                          {isSaving[`${agent.id}-na`] && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto shrink-0" />}
                        </div>
                      </div>

                      {/* Rule Inputs */}
                      {competitionRules.map((rule) => {
                        if (rule.isCheckbox) {
                          return (
                            <div key={rule.id} className="w-[120px] shrink-0 p-2 text-center border-r border-muted/50">
                              <div className="flex justify-center">
                                <Switch
                                  checked={taskInputs[agent.id!]?.[rule.id!]?.checked || false}
                                  onCheckedChange={(checked) => handleTaskChange(agent.id!, rule.id!, checked)}
                                  disabled={isAbsent || isSaving[`task-${agent.id!}-${rule.id!}`]}
                                />
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={rule.id} className="w-[120px] shrink-0 p-2 text-center border-r border-muted/50">
                            {isAbsent ? (
                              <span className="text-muted-foreground italic text-xs">Absent</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0'}
                                  onChange={(e) => handleInputChange(agent.id!, rule.id!, e.target.value)}
                                  className="w-14 h-8 text-center bg-background"
                                  disabled={isSaving[`${agent.id!}-${rule.id!}`]}
                                />
                                <div className="flex flex-col">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-6 text-xs hover:bg-muted"
                                    onClick={() => handleIncrement(agent.id!, rule.id!, achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0')}
                                    disabled={isSaving[`${agent.id!}-${rule.id!}`]}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-6 text-xs hover:bg-muted"
                                    onClick={() => handleDecrement(agent.id!, rule.id!, achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0')}
                                    disabled={isSaving[`${agent.id!}-${rule.id!}`] || parseInt(achievementInputs[agent.id!]?.[rule.id!]?.value ?? '0') <= 0}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {canLog && teams.length > 0 && (
          <Card className="frosted-glass">
            <CardHeader>
              <CardTitle>Team Bonus Points</CardTitle>
              <CardDescription>Award or deduct points from teams for the selected day.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {teams.map(team => (
                  <Card key={team.id} className="shadow-sm frosted-glass">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {team.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">{bonusInputs[team.id]?.points ?? 0}</span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-b-none border-b-0"
                          onClick={() => handleBonusPointsChange(team.id, 1)}
                          disabled={isSavingBonus}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-t-none"
                          onClick={() => handleBonusPointsChange(team.id, -1)}
                          disabled={isSavingBonus}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
