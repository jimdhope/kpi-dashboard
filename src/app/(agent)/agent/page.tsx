
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Leaderboard } from '@/components/leaderboard';
import { Target, CheckSquare, ListChecks, MessageSquare, ListTodo, Trophy, Swords, Edit, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert";
import { collection, query, where, Timestamp, doc, getDoc, orderBy, onSnapshot, Unsubscribe, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
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
// Import the new types from the settings page
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
const SETTINGS_DOC_ID = "agentDashboardSettings_v3"; // Ensure this matches the settings page

export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [agentPodId, setAgentPodId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const [podLogs, setPodLogs] = useState<DailyAchievementLog[]>([]);
  const [podBonusLogs, setPodBonusLogs] = useState<TeamBonusLog[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null);
  const [allCompetitions, setAllCompetitions] = useState<CompetitionWithRules[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');

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

    return () => cleanupListeners(['auth', 'userDoc']);
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
    
    const compDocRef = doc(db, 'competitions', selectedCompetitionId);
    listenerRefs.current.competition = onSnapshot(compDocRef, (compSnap) => {
        if (!isMounted || !compSnap.exists()) return;
        const newActiveComp = { id: compSnap.id, ...compSnap.data() } as CompetitionWithRules;
        setActiveCompetition(newActiveComp);
        setRules(newActiveComp.rules || []);
        setTeams(newActiveComp.teams || []);

        // Listen to other data sources based on this competition
        const agentsQuery = query(collection(db, 'users'), where('podId', '==', agentPodId), orderBy('name'));
        listenerRefs.current.agents = onSnapshot(agentsQuery, (snap) => { if(isMounted) setPodAgents(snap.docs.map(d => d.data() as AppUser)); });
        
        const logsQuery = query(collection(db, 'dailyAchievements'), where('podId', '==', agentPodId), where('competitionId', '==', selectedCompetitionId));
        listenerRefs.current.podLogs = onSnapshot(logsQuery, (snap) => { if(isMounted) setPodLogs(snap.docs.map(d => d.data() as DailyAchievementLog)); setIsLoadingData(false); });
        
        const bonusLogsQuery = query(collection(db, 'teamBonusLogs'), where('podId', '==', agentPodId), where('competitionId', '==', selectedCompetitionId));
        listenerRefs.current.podBonusLogs = onSnapshot(bonusLogsQuery, (snap) => { if(isMounted) setPodBonusLogs(snap.docs.map(d => d.data() as TeamBonusLog)); });
    }, (err) => { setError("Failed to load competition data."); setIsLoadingData(false); });
    
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
    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => { if(agent.id) agentScores[agent.id] = 0; });
    podLogs.forEach(log => {
      if (log.ruleId && rules.find(r => r.id === log.ruleId)?.type === 'numeric') {
        agentScores[log.agentId] = (agentScores[log.agentId] || 0) + (log.points || 0);
      }
    });

    const teamScores: Record<string, number> = {};
    teams.forEach(team => { teamScores[team.id] = 0; });
    podLogs.forEach(log => {
      const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
      if (agentTeam && rules.find(r => r.id === log.ruleId)?.type === 'numeric') {
          teamScores[agentTeam.id] = (teamScores[agentTeam.id] || 0) + (log.points || 0);
      }
    });
    podBonusLogs.forEach(log => { if(teamScores[log.teamId] !== undefined) teamScores[log.teamId] += log.points; });

    const podScores: Record<string, number> = { [agentPodId || '']: 0 };
    podLogs.forEach(log => {
      if (podScores.hasOwnProperty(log.podId) && rules.find(r => r.id === log.ruleId)?.type === 'numeric') {
        podScores[log.podId] = (podScores[log.podId] || 0) + (log.points || 0);
      }
    });


    const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
        const sorted = [...items].sort((a,b) => (b.score || 0) - (a.score || 0));
        const rankMap = new Map<number, number>();
        let rank = 1;
        sorted.forEach(item => { if(!rankMap.has(item.score)) rankMap.set(item.score, rank++); });
        return sorted.map(item => ({...item, rank: rankMap.get(item.score)!}));
    };

    return {
      agentLeaderboard: assignDenseRanks(podAgents.map(agent => ({ id: agent.id!, name: agent.name, score: agentScores[agent.id!] || 0, avatarUrl: agent.avatarUrl, avatarInitials: agent.avatarInitials, avatarBgColor: agent.avatarBgColor, isUser: agent.id === currentUser?.id }))),
      teamLeaderboard: assignDenseRanks(teams.map(team => ({ id: team.id, name: team.name, score: teamScores[team.id] || 0, emoji: team.emoji, isUser: team.agentIds?.includes(currentUser?.id || '') }))),
      podLeaderboard: assignDenseRanks(Object.entries(podScores).map(([id, score]) => ({ id, name: podAgents.find(p => p.podId === id)?.name || 'My Pod', score })))
    };
  }, [podLogs, podBonusLogs, podAgents, teams, rules, currentUser, agentPodId]);

  const isLoading = isLoadingUser || isLoadingData || isLoadingSettings;

    const renderWidget = (widget: SpecificWidget) => {
        if (!widget.isEnabled) return null;

        switch (widget.type) {
            case 'motd':
                return <MessageOfTheDayDisplay emoji={widget.emoji} content={widget.content} isLoading={isLoadingSettings} />;
            case 'leaderboard-agent':
                return <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} />;
            case 'leaderboard-team':
                return <Leaderboard title="Team Leaderboard" entries={teamLeaderboard} />;
            case 'leaderboard-pod':
                return <Leaderboard title="Pod Leaderboard" entries={podLeaderboard} />;
            case 'achievements':
                return <div>Achievements Placeholder</div>; // Replace with actual component
            case 'pod-targets':
                 return <div>Pod Targets Placeholder</div>; // Replace with actual component
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
           <div key={row.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
               {row.columns.map(column => {
                   if (!column.widget) return null;
                   return (
                        <div key={column.id} className="w-full">
                           {renderWidget(column.widget)}
                        </div>
                   )
               })}
           </div>
       ))}

       {(!dashboardSettings || dashboardSettings.rows.length === 0) && !isLoading && (
            <Card><CardHeader><CardTitle>Dashboard Not Configured</CardTitle><CardDescription>Your administrator has not configured the dashboard layout yet.</CardDescription></CardHeader></Card>
       )}

    </div>
  );
}
