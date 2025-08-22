
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, CheckSquare, ListChecks, MessageSquare, ListTodo, Trophy, Swords, Edit, Trash2, Plus, Minus, Loader2, Filter } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert";
import { collection, query, where, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
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
import { AgentLeaderboardWidget } from '@/components/agent-leaderboard-widget';
import { PodTargetsWidget } from '@/components/pod-targets-widget';
import { TodaysAchievementsWidget } from '@/components/todays-achievements-widget';


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

export interface CompetitionWithRules extends Competition {
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
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);

  // Competition and Rules Data
  const [allCompetitions, setAllCompetitions] = useState<CompetitionWithRules[]>([]);
  
  // Loading and Settings States
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettingsData | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [activeCompetitionId, setActiveCompetitionId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [dailyTaskLogs, setDailyTaskLogs] = useState<DailyTaskLog[]>([]);

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
    return () => cleanupListeners(['auth', 'userDoc']);
  }, [cleanupListeners]);

  // Effect to fetch all competitions for the user's pod
  useEffect(() => {
      if (isLoadingUser || !agentPodId) return;

      const compQuery = query(collection(db, 'competitions'), where('podIds', 'array-contains', agentPodId), orderBy('startDate', 'desc'));
      const unsubscribeComps = onSnapshot(compQuery, (snapshot) => {
          const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithRules));
          setAllCompetitions(fetchedComps);
          // Set active competition to the latest one
          if (fetchedComps.length > 0) {
            setActiveCompetitionId(fetchedComps[0].id);
          }
      });
      return () => unsubscribeComps();
  }, [isLoadingUser, agentPodId]);


  // Main data loading effect based on active competition
  useEffect(() => {
    if (!activeCompetitionId || !agentPodId || !currentUser?.id) {
        setIsLoadingData(false);
        return;
    }

    setIsLoadingData(true);
    const todayStart = startOfDay(new Date());

    const compDocRef = doc(db, 'competitions', activeCompetitionId);
    const unsubscribeComp = onSnapshot(compDocRef, (compSnap) => {
        if (compSnap.exists()) {
            const compData = { id: compSnap.id, ...compSnap.data() } as CompetitionWithRules;
            setRules(compData.rules || []);
        }
    });

    const agentsQuery = query(collection(db, 'users'), where('podId', '==', agentPodId), orderBy('name'));
    const unsubscribeAgents = onSnapshot(agentsQuery, (snap) => {
        setPodAgents(snap.docs.map(d => d.data() as AppUser));
    });
    
    const taskLogsQuery = query(collection(db, 'dailyTaskLogs'), where('agentId', '==', currentUser.id), where('competitionId', '==', activeCompetitionId), where('date', '==', Timestamp.fromDate(todayStart)));
    const unsubscribeTasks = onSnapshot(taskLogsQuery, (snap) => {
        setDailyTaskLogs(snap.docs.map(d => d.data() as DailyTaskLog));
        setIsLoadingData(false); // Mark loading as complete here
    });

    return () => {
        unsubscribeComp();
        unsubscribeAgents();
        unsubscribeTasks();
    };
  }, [activeCompetitionId, agentPodId, currentUser?.id]);


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


  const isLoading = isLoadingUser || isLoadingData || isLoadingSettings;

    const renderWidget = (widget: SpecificWidget) => {
        if (!widget.isEnabled) return null;

        switch (widget.type) {
            case 'motd':
                return <MessageOfTheDayDisplay title={widget.title} emoji={widget.emoji} content={widget.content} isLoading={isLoadingSettings} />;
            case 'leaderboard-agent':
                return <AgentLeaderboardWidget
                           allCompetitions={allCompetitions}
                           podId={agentPodId}
                           currentUser={currentUser}
                       />;
            case 'leaderboard-team':
                return <Card><CardHeader><CardTitle>Team Leaderboard</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">This leaderboard is temporarily unavailable.</p></CardContent></Card>;
            case 'leaderboard-pod':
                return <Card><CardHeader><CardTitle>Pod Leaderboard</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">This leaderboard is temporarily unavailable.</p></CardContent></Card>;
            case 'achievements':
                 return <TodaysAchievementsWidget
                            currentUser={currentUser}
                            activeCompetitionId={activeCompetitionId}
                        />;
            case 'pod-targets':
                return <PodTargetsWidget
                            agentPodId={agentPodId}
                            activeCompetitionId={activeCompetitionId}
                            podAgents={podAgents}
                        />;
            case 'log-achievements':
                return <LogAchievementsWidget 
                            rules={rules}
                            currentUser={currentUser}
                            agentPodId={agentPodId}
                            activeCompetitionId={activeCompetitionId}
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

    // Effect to populate initial state from Firestore
    useEffect(() => {
        if (!currentUser?.id || !agentPodId || !activeCompetitionId) return;

        const dateTimestamp = Timestamp.fromDate(startOfDay(new Date()));
        
        const achievementsQuery = query(
            collection(db, 'dailyAchievements'),
            where('agentId', '==', currentUser.id),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetitionId)
        );
        
        const taskLogsQuery = query(
            collection(db, 'dailyTaskLogs'),
            where('agentId', '==', currentUser.id),
            where('date', '==', dateTimestamp),
            where('competitionId', '==', activeCompetitionId)
        );

        const unsubAchievements = onSnapshot(achievementsQuery, (snapshot) => {
            const initialInputs: typeof achievementInputs = {};
            snapshot.forEach(doc => {
                const log = doc.data() as DailyAchievementLog;
                initialInputs[log.ruleId] = { value: log.value, logId: doc.id };
            });
            setAchievementInputs(initialInputs);
        });

         const unsubTasks = onSnapshot(taskLogsQuery, (snapshot) => {
            const initialTaskInputs: typeof taskInputs = {};
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
             const points = (rule.points || 0) * value;
             if (logId) { // Update or delete existing
                 if (value > 0) {
                     await setDoc(doc(db, 'dailyAchievements', logId), { value, points }, { merge: true });
                 } else {
                     await deleteDoc(doc(db, 'dailyAchievements', logId));
                     setAchievementInputs(prev => { const newState = {...prev}; delete newState[ruleId]; return newState; });
                 }
             } else if (value > 0) { // Create new
                 const newDocRef = await addDoc(collection(db, 'dailyAchievements'), {
                     agentId: currentUser.id, podId: agentPodId, competitionId: activeCompetitionId,
                     ruleId, ruleName: rule.name, date: dateTimestamp, value, points,
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
