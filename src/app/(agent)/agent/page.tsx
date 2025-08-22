
'use client';

import React, { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { DashboardSettingsData, SpecificWidget } from '@/app/(admin)/admin/message-of-the-day/page';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { AgentLeaderboardWidget } from '@/components/agent/AgentLeaderboardWidget';
import { PodTargetsWidget } from '@/components/agent/PodTargetsWidget';
import { TodaysAchievementsWidget } from '@/components/agent/TodaysAchievementsWidget';
import { LogAchievementsWidget } from '@/components/agent/LogAchievementsWidget';
import { MessageOfTheDayWidget } from '@/components/agent/MessageOfTheDayWidget';
import { TeamLeaderboardWidget } from '@/components/agent/TeamLeaderboardWidget';
import { PodLeaderboardWidget } from '@/components/agent/PodLeaderboardWidget';


const SETTINGS_DOC_ID = "agentDashboardSettings_v3";

export default function AgentDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettingsData | null>(null);

  // Effect for fetching user and dashboard settings
  useEffect(() => {
    setIsLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as AppUser;
            setCurrentUser(userData);
            if (!userData.podId) {
              setError("You are not assigned to a pod.");
            }
          } else {
            setError("User profile not found.");
            setCurrentUser(null);
          }
        }, (err) => {
          console.error("Error fetching user profile:", err);
          setError("Failed to load user profile.");
          setCurrentUser(null);
        });

        const settingsDocRef = doc(db, "settings", SETTINGS_DOC_ID);
        const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
          setDashboardSettings(docSnap.exists() ? docSnap.data() as DashboardSettingsData : null);
          setIsLoading(false); // Consider loading finished after both fetches start
        }, (err) => {
            console.error("Error fetching settings:", err);
            setDashboardSettings(null);
            setIsLoading(false);
        });
        
        return () => {
            unsubscribeUser();
            unsubscribeSettings();
        };

      } else {
        setError("You must be logged in.");
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const renderWidget = (widget: SpecificWidget) => {
    if (!widget.isEnabled || !currentUser) return null;

    switch (widget.type) {
        case 'motd':
            return <MessageOfTheDayWidget widget={widget} />;
        case 'leaderboard-agent':
            return <AgentLeaderboardWidget currentUser={currentUser} />;
        case 'leaderboard-team':
             return <TeamLeaderboardWidget currentUser={currentUser} />;
        case 'leaderboard-pod':
             return <PodLeaderboardWidget currentUser={currentUser} />;
        case 'achievements':
             return <TodaysAchievementsWidget currentUser={currentUser} />;
        case 'pod-targets':
            return <PodTargetsWidget currentUser={currentUser} />;
        case 'log-achievements':
            return <LogAchievementsWidget currentUser={currentUser} />;
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
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      
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
