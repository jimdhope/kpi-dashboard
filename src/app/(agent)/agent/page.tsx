
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, CheckSquare, ListChecks, MessageSquare, ListTodo, Trophy, Swords, Edit, Trash2, Plus, Minus, Loader2, Filter } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert";
import { collection, query, where, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog, DailyTaskLog, TeamBonusLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/models/types';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { format, startOfDay, endOfDay, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AchievementCard } from '@/components/achievement-card';
import { Progress } from '@/components/ui/progress';
import { MessageOfTheDayDisplay } from '@/components/message-of-the-day-display';
import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DashboardSettingsData, SpecificWidget, Row as LayoutRow, Column as LayoutColumn } from '@/app/(admin)/admin/message-of-the-day/page';


// Interfaces (most are the same)
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  emoji?: string;
  isUser?: boolean;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface CompetitionWithRules extends Competition {
    teams?: Team[];
    id: string;
}

interface PodTargetSummary {
  ruleId: string;
  ruleName: string;
  ruleEmoji: string;
  achieved: number;
  individualTarget: number | null;
  podTarget: number | null;
  progress?: number;
}

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const AGENT_DASHBOARD_COMP_KEY = 'agentDashboard_selectedCompetitionId';
const SETTINGS_DOC_ID = "agentDashboardSettings_v3";

// Debounce utility function
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // User and Pod Data
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);

  // Competition and Rules Data
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null);
  const [allCompetitions, setAllCompetitions] = useState<CompetitionWithRules[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Daily Dynamic Data
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [competitionBonusLogs, setCompetitionBonusLogs] = useState<TeamBonusLog[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargetData | null>(null);
  const [dailyTaskLogs, setDailyTaskLogs] = useState<DailyTaskLog[]>([]);


  // Loading and Settings States
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettingsData | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const listenerRefs = React.useRef<{ [key: string]: Unsubscribe | undefined }>({});

  const cleanupListeners = useCallback((specificListeners?: string[]) => {
    const listenersToClean = specificListeners || Object.keys(listenerRefs.current);
    listenersToClean.forEach(key => {
        if (listenerRefs.current[key]) {
            try { listenerRefs.current[key]!(); } catch (e) { console.error(`Error unsubscribing from ${key}:`, e); }
            listenerRefs.current[key] = undefined;
        }
    });
    if (!specificListeners) { listenerRefs.current = {}; }
  }, []);

  // Effect for fetching user data and all their possible competitions
  useEffect(() => {
    setIsLoadingUser(true);
    cleanupListeners(['auth', 'userDoc']);

    listenerRefs.current.auth = auth.onAuthStateChanged(user => {
        cleanupListeners(['userDoc']);
        if (user) {
            listenerRefs.current.userDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
                    setCurrentUser(userData);
                    setAgentPodId(userData.podId || null);
                    if (!userData.podId) setError("You are not assigned to a pod.");
                } else {
                    setError("User profile not found.");
                    setCurrentUser(null); setAgentPodId(null);
                }
                setIsLoadingUser(false);
            }, (err) => { setError("Failed to load profile."); setIsLoadingUser(false); });
        } else {
            setError("You must be logged in.");
            setCurrentUser(null); setAgentPodId(null); setIsLoadingUser(false);
        }
    });

    // Fetch all pods once for leaderboard display
    const podsQuery = query(collection(db, 'pods'), orderBy('name'));
    listenerRefs.current.allPods = onSnapshot(podsQuery, (snap) => {
      setAllPods(snap.docs.map(d => ({id: d.id, ...d.data()} as Pod)));
    });


    return () => cleanupListeners(['auth', 'userDoc', 'allPods']);
  }, [cleanupListeners]);

  // Effect to fetch all competitions for the user's pod
  useEffect(() => {
      if (isLoadingUser || !agentPodId) return;

      const compQuery = query(collection(db, 'competitions'), where('podIds', 'array-contains', agentPodId), orderBy('startDate', 'desc'));
      const unsubscribeComps = onSnapshot(compQuery, (snapshot) => {
          const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithRules));
          setAllCompetitions(fetchedComps);
          const savedCompId = localStorage.getItem(AGENT_DASHBOARD_COMP_KEY);
          if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
              setSelectedCompetitionId(savedCompId);
          } else if (fetchedComps.length > 0) {
              const latestActiveComp = fetchedComps.find(c => c.endDate.toDate() >= startOfDay(new Date())) || fetchedComps[0];
              setSelectedCompetitionId(latestActiveComp.id);
          }
      });

      return () => unsubscribeComps();
  }, [isLoadingUser, agentPodId]);


  // Main data loading effect based on selected competition
  useEffect(() => {
    if (!selectedCompetitionId || !agentPodId || !currentUser?.id) {
        setIsLoadingData(false);
        return () => cleanupListeners();
    }

    setIsLoadingData(true);
    let isMounted = true;
    const todayStart = startOfDay(new Date());

    const setupListeners = async () => {
        try {
             cleanupListeners(); // Clean up previous listeners before setting up new ones
             const compDocRef = doc(db, 'competitions', selectedCompetitionId);
             listenerRefs.current.competition = onSnapshot(compDocRef, (compSnap) => {
                 if (!isMounted || !compSnap.exists()) return;
                 const newActiveComp = { id: compSnap.id, ...compSnap.data() } as CompetitionWithRules;
                 setActiveCompetition(newActiveComp);
                 setRules(newActiveComp.rules || []);
                 setTeams(newActiveComp.teams || []);
                 
                 // Fetch logs for all pods in this competition
                 if (newActiveComp.podIds && newActiveComp.podIds.length > 0) {
                    const logsQuery = query(collection(db, 'dailyAchievements'), where('competitionId', '==', selectedCompetitionId));
                    listenerRefs.current.competitionLogs = onSnapshot(logsQuery, (snap) => { if(isMounted) setCompetitionLogs(snap.docs.map(d => d.data() as DailyAchievementLog)); });

                    const bonusLogsQuery = query(collection(db, 'teamBonusLogs'), where('competitionId', '==', selectedCompetitionId));
                    listenerRefs.current.competitionBonusLogs = onSnapshot(bonusLogsQuery, (snap) => { if(isMounted) setCompetitionBonusLogs(snap.docs.map(d => d.data() as TeamBonusLog)); });
                 }
             });

            const agentsQuery = query(collection(db, 'users'), where('podId', '==', agentPodId), orderBy('name'));
            listenerRefs.current.agents = onSnapshot(agentsQuery, (snap) => { if(isMounted) setPodAgents(snap.docs.map(d => d.data() as AppUser)); });
            
             const taskLogsQuery = query(collection(db, 'dailyTaskLogs'), where('agentId', '==', currentUser.id), where('competitionId', '==', selectedCompetitionId), where('date', '==', Timestamp.fromDate(todayStart)));
             listenerRefs.current.taskLogs = onSnapshot(taskLogsQuery, (snap) => { if(isMounted) setDailyTaskLogs(snap.docs.map(d => d.data() as DailyTaskLog)); });

             const targetsDocId = `${selectedCompetitionId}_${agentPodId}`;
             const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
             listenerRefs.current.targets = onSnapshot(targetsDocRef, (docSnap) => {
                 if (isMounted) {
                    setDailyTargets(docSnap.exists() ? docSnap.data() as DailyTargetData : null);
                    setIsLoadingData(false); // Mark loading as complete here
                 }
             });

        } catch (error) {
            console.error("Error setting up listeners:", error);
            if(isMounted) {
                setError("Failed to load dashboard data.");
                setIsLoadingData(false);
            }
        }
    };
    
    setupListeners();
    
    return () => { isMounted = false; cleanupListeners(); };
  }, [selectedCompetitionId, agentPodId, currentUser?.id, cleanupListeners]);

  // Settings fetcher
  useEffect(() => {
      setIsLoadingSettings(true);
      const settingsDocRef = doc(db, "settings", SETTINGS_DOC_ID);
      const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
          setDashboardSettings(docSnap.exists() ? docSnap.data() as DashboardSettingsData : null);
          setIsLoadingSettings(false);
      }, () => { setIsLoadingSettings(false); });
      return () => unsubscribeSettings();
  }, []);

  const { agentLeaderboard, teamLeaderboard, podLeaderboard } = useMemo(() => {
    if (!activeCompetition || !allPods.length) {
        return { agentLeaderboard: [], teamLeaderboard: [], podLeaderboard: [] };
    }

    const podsInComp = allPods.filter(p => activeCompetition.podIds?.includes(p.id));

    // --- Agent Leaderboard (scoped to current user's pod) ---
    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => {
        if (agent.id) {
            const agentLogs = competitionLogs.filter(log => log.agentId === agent.id);
            agentScores[agent.id] = agentLogs.reduce((sum, log) => sum + (log.points || 0), 0);
        }
    });
    const finalAgentLeaderboard = podAgents.map(agent => ({
        id: agent.id!,
        name: agent.name,
        score: agentScores[agent.id!] || 0,
        avatarUrl: agent.avatarUrl,
        avatarInitials: agent.avatarInitials,
        avatarBgColor: agent.avatarBgColor,
        isUser: agent.id === currentUser?.id
    }));

    // --- Team Leaderboard (scoped to current user's pod's teams) ---
    const teamScores: Record<string, number> = {};
    teams.forEach(team => {
        const achievementPoints = competitionLogs
            .filter(log => team.agentIds.includes(log.agentId))
            .reduce((sum, log) => sum + (log.points || 0), 0);
        
        const bonusPoints = competitionBonusLogs
            .filter(log => log.teamId === team.id)
            .reduce((sum, log) => sum + (log.points || 0), 0);

        teamScores[team.id] = achievementPoints + bonusPoints;
    });
    const finalTeamLeaderboard = teams.map(team => ({
        id: team.id,
        name: team.name,
        score: teamScores[team.id] || 0,
        emoji: team.emoji,
        isUser: team.agentIds?.includes(currentUser?.id || '')
    }));

    // --- Pod Leaderboard (all pods in competition) ---
    const podScores: Record<string, number> = {};
    podsInComp.forEach(pod => {
        podScores[pod.id] = competitionLogs
            .filter(log => log.podId === pod.id)
            .reduce((sum, log) => sum + (log.points || 0), 0);
    });
    const finalPodLeaderboard = podsInComp.map(pod => ({
        id: pod.id,
        name: pod.name,
        score: podScores[pod.id] || 0,
        avatarUrl: pod.logoUrl,
        avatarInitials: pod.logoInitials,
        avatarBgColor: pod.logoBgColor,
        isUser: pod.id === agentPodId
    }));

    return {
      agentLeaderboard: finalAgentLeaderboard,
      teamLeaderboard: finalTeamLeaderboard,
      podLeaderboard: finalPodLeaderboard,
    };
}, [competitionLogs, competitionBonusLogs, podAgents, teams, activeCompetition, currentUser, allPods, agentPodId]);

  const isLoading = isLoadingUser || isLoadingData || isLoadingSettings;

    const renderWidget = (widget: SpecificWidget) => {
        if (!widget.isEnabled) return null;

        switch (widget.type) {
            case 'motd':
                return <MessageOfTheDayDisplay title={widget.title} emoji={widget.emoji} content={widget.content} isLoading={isLoadingSettings} />;
            case 'leaderboard-agent':
                return <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} />;
            case 'leaderboard-team':
                return <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} />;
            case 'leaderboard-pod':
                return <Leaderboard title="Pod Leaderboard" entries={podLeaderboard} />;
            case 'achievements':
                 return <TodaysAchievementsWidget
                           rules={rules}
                           podLogs={competitionLogs.filter(l => l.podId === agentPodId)}
                           dailyTaskLogs={dailyTaskLogs}
                           currentUser={currentUser}
                        />;
            case 'pod-targets':
                 return <PodTargetsWidget
                            rules={rules}
                            podLogs={competitionLogs.filter(l => l.podId === agentPodId)}
                            dailyTargets={dailyTargets}
                            podAgents={podAgents}
                        />;
            case 'log-achievements':
                return <LogAchievementsWidget 
                            rules={rules}
                            currentUser={currentUser}
                            agentPodId={agentPodId}
                            activeCompetitionId={activeCompetition?.id}
                            toast={toast}
                       />;
            case 'custom-html':
                 return (
                     <Card>
                         <CardHeader><CardTitle>{widget.name}</CardTitle></CardHeader>
                         <CardContent>
                            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: widget.content }} />
                         </CardContent>
                     </Card>
                 );
            default:
                return null;
        }
    };

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><UIDescription>{error}</UIDescription></Alert>}
      
       {allCompetitions.length > 1 && !isLoading && (
        <Card className="frosted-glass">
            <CardContent className="p-4">
                 <div className="grid gap-2 w-full max-w-xs">
                    <Label htmlFor="competition-select">Viewing Competition</Label>
                    <Select
                        value={selectedCompetitionId}
                        onValueChange={(value) => {
                            setSelectedCompetitionId(value);
                            localStorage.setItem(AGENT_DASHBOARD_COMP_KEY, value);
                        }}
                        disabled={isLoading}
                    >
                        <SelectTrigger id="competition-select">
                            <SelectValue placeholder="Select Competition" />
                        </SelectTrigger>
                        <SelectContent>
                            {allCompetitions.map(comp => (
                                <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
       )}


       {isLoading ? (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <div className="grid md:grid-cols-2 gap-6"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
            </div>
       ) : dashboardSettings?.rows?.map(row => (
           <div key={row.id} className="flex flex-wrap md:flex-nowrap gap-6 items-start">
               {row.columns.map(column => (
                    <div key={column.id} className="w-full space-y-6" style={{ flexBasis: `${column.width}%` }}>
                        {column.showName && column.name && (
                            <h3 className="text-lg font-semibold tracking-tight">{column.name}</h3>
                        )}
                       {column.widgets.map(widget => (
                           <div key={widget.id}>
                            {renderWidget(widget)}
                           </div>
                       ))}
                    </div>
               ))}
           </div>
       ))}

       {(!dashboardSettings || dashboardSettings.rows.length === 0) && !isLoading && (
            <Card><CardHeader><CardTitle>Dashboard Not Configured</CardTitle><CardDescription>Your administrator has not configured the dashboard layout yet.</CardDescription></CardHeader></Card>
       )}

    </div>
  );
}


// --- WIDGET COMPONENTS ---

interface TodaysAchievementsWidgetProps {
    rules: RuleFormData[];
    podLogs: DailyAchievementLog[];
    dailyTaskLogs: DailyTaskLog[];
    currentUser: AppUser | null;
}

const TodaysAchievementsWidget: React.FC<TodaysAchievementsWidgetProps> = ({ rules, podLogs, dailyTaskLogs, currentUser }) => {
    const { dailyAchievements, completedTasks, totalPoints } = useMemo(() => {
        const todayStart = startOfDay(new Date());
        const agentLogsToday = podLogs.filter(log =>
            log.agentId === currentUser?.id &&
            log.date instanceof Timestamp &&
            startOfDay(log.date.toDate()).getTime() === todayStart.getTime()
        );

        const agentTasksToday = dailyTaskLogs.filter(log => log.agentId === currentUser?.id);

        const achievements: { name: string; emoji: string; value: number }[] = [];
        let points = 0;

        rules.forEach(rule => {
            if (rule.type === 'numeric') {
                const log = agentLogsToday.find(l => l.ruleId === rule.id);
                if (log) {
                    achievements.push({ name: rule.name, emoji: rule.emoji || '🎯', value: log.value });
                    points += log.points || 0;
                }
            }
        });

        const tasks = agentTasksToday.map(taskLog => {
            const rule = rules.find(r => r.id === taskLog.taskId && r.type === 'checkbox');
            return { name: rule?.name || 'Task', emoji: rule?.emoji || '✅' };
        });
        
        return { dailyAchievements: achievements, completedTasks: tasks, totalPoints: points };
    }, [rules, podLogs, dailyTaskLogs, currentUser]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" /> Today's Achievements</CardTitle>
                <CardDescription>Your logged progress for today. Total points today: <strong className="text-primary">{totalPoints}</strong></CardDescription>
            </CardHeader>
            <CardContent>
                {dailyAchievements.length === 0 && completedTasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No achievements logged yet today.</p>
                ) : (
                    <ul className="space-y-2 text-sm">
                        {dailyAchievements.map((ach, i) => (
                             <li key={`ach-${i}`} className="flex justify-between items-center">
                               <span>{ach.emoji} {ach.name}</span>
                               <span className="font-semibold">{ach.value}</span>
                           </li>
                        ))}
                         {completedTasks.map((task, i) => (
                             <li key={`task-${i}`} className="flex items-center gap-2 text-muted-foreground">
                               <span>{task.emoji}</span>
                               <span>{task.name}</span>
                           </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
};


interface PodTargetsWidgetProps {
    rules: RuleFormData[];
    podLogs: DailyAchievementLog[];
    dailyTargets: DailyTargetData | null;
    podAgents: AppUser[];
}

const PodTargetsWidget: React.FC<PodTargetsWidgetProps> = ({ rules, podLogs, dailyTargets, podAgents }) => {
    const podTargetSummary = useMemo(() => {
        const todayStart = startOfDay(new Date());
        const dayOfWeek = daysOfWeek[getDay(todayStart)];
        const numericRules = rules.filter(r => r.type === 'numeric' && r.id && dailyTargets?.[r.id]?.[dayOfWeek] !== undefined);
        const dailyLogsForPod = podLogs.filter(log => log.date instanceof Timestamp && startOfDay(log.date.toDate()).getTime() === todayStart.getTime());
        const absentAgentIds = new Set(dailyLogsForPod.filter(log => log.status === 'absent').map(log => log.agentId));
        const activeAgentCount = podAgents.filter(agent => !absentAgentIds.has(agent.id!)).length;

        return numericRules.map(rule => {
            const achieved = dailyLogsForPod.filter(l => l.ruleId === rule.id && l.status !== 'absent').reduce((sum, l) => sum + (l.value || 0), 0);
            const individualTarget = dailyTargets?.[rule.id!]?.[dayOfWeek];
            const podTarget = (individualTarget ?? 0) * activeAgentCount;
            const progress = podTarget > 0 ? Math.min(Math.round((achieved / podTarget) * 100), 100) : (achieved > 0 ? 100 : 0);

            return {
                ruleId: rule.id!,
                ruleName: rule.name,
                ruleEmoji: rule.emoji || '🎯',
                achieved,
                podTarget,
                progress
            };
        });
    }, [rules, podLogs, dailyTargets, podAgents]);
    
    return (
        <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Pod Targets Today</CardTitle>
                <CardDescription>Your pod's collective progress towards daily goals.</CardDescription>
            </CardHeader>
            <CardContent>
                {podTargetSummary.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No daily targets set for your pod today.</p>
                ) : (
                    <div className="space-y-4">
                        {podTargetSummary.map(summary => (
                            <div key={summary.ruleId}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="font-medium truncate" title={summary.ruleName}>
                                        {summary.ruleEmoji} {summary.ruleName}
                                    </span>
                                    <span className={cn("font-semibold", summary.progress >= 100 ? "text-green-600" : "text-muted-foreground")}>
                                        {summary.achieved.toLocaleString()} / {summary.podTarget.toLocaleString()}
                                    </span>
                                </div>
                                <Progress value={summary.progress} className="h-2" />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// New Widget for Logging
interface LogAchievementsWidgetProps {
    rules: RuleFormData[];
    currentUser: AppUser | null;
    agentPodId: string | null;
    activeCompetitionId: string | null;
    toast: any; // Simplified toast type
}

const LogAchievementsWidget: React.FC<LogAchievementsWidgetProps> = ({ rules, currentUser, agentPodId, activeCompetitionId, toast }) => {
    const [achievementInputs, setAchievementInputs] = useState<Record<string, { value: number; logId?: string }>>({});
    const [taskInputs, setTaskInputs] = useState<Record<string, { checked: boolean; logId?: string }>>({});
    const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

    // Effect to populate initial state from Firestore (one-time fetch or could be listener)
    useEffect(() => {
        if (!currentUser?.id || !agentPodId || !activeCompetitionId) return;

        const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
        const initialInputs: typeof achievementInputs = {};
        const initialTaskInputs: typeof taskInputs = {};

        const achievementsQuery = query(
            collection(db, 'dailyAchievements'),
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetitionId)
        );
        
        const taskLogsQuery = query(
            collection(db, 'dailyTaskLogs'),
            where('agentId', '==', currentUser.id),
            where('podId', '==', agentPodId),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetitionId)
        );

        const unsubAchievements = onSnapshot(achievementsQuery, (snapshot) => {
            snapshot.forEach(doc => {
                const log = doc.data() as DailyAchievementLog;
                initialInputs[log.ruleId] = { value: log.value, logId: doc.id };
            });
            setAchievementInputs(initialInputs);
        });

         const unsubTasks = onSnapshot(taskLogsQuery, (snapshot) => {
            snapshot.forEach(doc => {
                const log = doc.data() as DailyTaskLog;
                initialTaskInputs[log.taskId] = { checked: true, logId: doc.id };
            });
             setTaskInputs(initialTaskInputs);
        });

        return () => {
            unsubAchievements();
            unsubTasks();
        };

    }, [currentUser, agentPodId, activeCompetitionId]);

    const handleSaveAchievement = useCallback(async (ruleId: string, value: number) => {
         if (!agentPodId || !currentUser?.id || !activeCompetitionId) return;
         const rule = rules.find(r => r.id === ruleId);
         if (!rule) return;

         setIsSaving(prev => ({...prev, [ruleId]: true }));
         const logId = achievementInputs[ruleId]?.logId;
         const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
         
         try {
             if (logId) { // Update or delete existing
                 if (value > 0) {
                     await setDoc(doc(db, 'dailyAchievements', logId), { value, points: (rule.points || 0) * value }, { merge: true });
                 } else {
                     await deleteDoc(doc(db, 'dailyAchievements', logId));
                     setAchievementInputs(prev => { const newState = {...prev}; delete newState[ruleId]; return newState; });
                 }
             } else if (value > 0) { // Create new
                 const newDocRef = await addDoc(collection(db, 'dailyAchievements'), {
                     agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetitionId,
                     ruleId, ruleName: rule.name, date: dateTimestamp, value, points: (rule.points || 0) * value,
                     loggedAt: serverTimestamp(), loggedBy: currentUser.uid
                 });
                 setAchievementInputs(prev => ({...prev, [ruleId]: { ...prev[ruleId], logId: newDocRef.id }}));
             }
         } catch (e) {
             toast({ variant: 'destructive', title: 'Save Failed' });
         } finally {
             setIsSaving(prev => ({...prev, [ruleId]: false }));
         }
    }, [agentPodId, currentUser, activeCompetitionId, rules, achievementInputs, toast]);

    const handleTaskChange = useCallback(async (ruleId: string, checked: boolean) => {
        if (!agentPodId || !currentUser?.id || !activeCompetitionId) return;
        setIsSaving(prev => ({...prev, [ruleId]: true }));
        const logId = taskInputs[ruleId]?.logId;
        
        try {
            if (checked) {
                if (!logId) {
                     const newDocRef = await addDoc(collection(db, 'dailyTaskLogs'), {
                         agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetitionId,
                         taskId: ruleId, date: Timestamp.fromDate(startOfDay(new Date())),
                         loggedAt: serverTimestamp(), loggedBy: currentUser.uid
                     });
                     setTaskInputs(prev => ({...prev, [ruleId]: { ...prev[ruleId], logId: newDocRef.id }}));
                }
            } else {
                 if (logId) {
                     await deleteDoc(doc(db, 'dailyTaskLogs', logId));
                     setTaskInputs(prev => { const newState = {...prev}; delete newState[ruleId]; return newState; });
                 }
            }
        } catch (e) {
             toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSaving(prev => ({...prev, [ruleId]: false }));
        }
    }, [agentPodId, currentUser, activeCompetitionId, taskInputs, toast]);


    const debouncedSave = useMemo(() => debounce(handleSaveAchievement, 1000), [handleSaveAchievement]);

    const handleValueChange = (ruleId: string, change: number) => {
        const currentValue = achievementInputs[ruleId]?.value ?? 0;
        const newValue = Math.max(0, currentValue + change);
        setAchievementInputs(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], value: newValue } }));
        debouncedSave(ruleId, newValue);
    };

    const numericRules = rules.filter(r => r.type === 'numeric');
    const taskRules = rules.filter(r => r.type === 'checkbox');

    if (numericRules.length === 0 && taskRules.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary"/> Log Today's Progress</CardTitle>
                <CardDescription>Your changes are saved automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {numericRules.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                        {numericRules.map(rule => (
                            <div key={rule.id} className="flex-auto min-w-[200px]">
                                <AchievementCard
                                    rule={rule}
                                    currentValue={achievementInputs[rule.id!]?.value ?? 0}
                                    isSaving={isSaving[rule.id!] || false}
                                    onIncrement={() => handleValueChange(rule.id!, 1)}
                                    onDecrement={() => handleValueChange(rule.id!, -1)}
                                />
                            </div>
                        ))}
                    </div>
                )}
                {taskRules.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                         <Label className="text-sm font-medium">Daily Tasks</Label>
                        {taskRules.map(rule => (
                            <div key={rule.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`task-${rule.id}`}
                                    checked={taskInputs[rule.id!]?.checked || false}
                                    onCheckedChange={(checked) => handleTaskChange(rule.id!, !!checked)}
                                    disabled={isSaving[rule.id!] || false}
                                />
                                <label htmlFor={`task-${rule.id}`} className="text-sm font-normal">
                                    {rule.emoji} {rule.name}
                                </label>
                                {isSaving[rule.id!] && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
