'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManagementDashboard } from '@/app/(admin)/admin/page';
import { AgentDashboard } from '@/app/(agent)/agent/page';
import type { AppUser } from '@/lib/contracts';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<'management' | 'agent' | null>(null);

  useEffect(() => {
    async function checkLandingPage() {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!response.ok) {
        router.replace('/login');
        return;
      }

      const session = await response.json();
      if (!session.authenticated || !session.user) {
        router.replace('/login');
        return;
      }

      const signedInUser = session.user as AppUser;
      const hasAgentRole = signedInUser.roles.includes('agent');
      const hasManagementRole = signedInUser.roles.some((role) => role !== 'agent');
      const requestedView = new URLSearchParams(window.location.search).get('view');

      setUser(signedInUser);
      setView(requestedView === 'agent' && hasAgentRole
        ? 'agent'
        : hasManagementRole ? 'management' : 'agent');
    }

    checkLandingPage();
  }, [router]);

  if (!user || !view) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAgentRole = user.roles.includes('agent');
  const hasManagementRole = user.roles.some((role) => role !== 'agent');
  const canSwitchViews = hasAgentRole && hasManagementRole;

  function changeView(nextView: 'management' | 'agent') {
    setView(nextView);
    router.replace(nextView === 'agent' ? '/dashboard?view=agent' : '/dashboard');
  }

  return (
    <div className="space-y-4">
      {canSwitchViews && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" aria-label="Dashboard view">
            <Button
              type="button"
              size="sm"
              variant={view === 'management' ? 'secondary' : 'ghost'}
              onClick={() => changeView('management')}
            >
              Admin view
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'agent' ? 'secondary' : 'ghost'}
              onClick={() => changeView('agent')}
            >
              Agent view
            </Button>
          </div>
        </div>
      )}
      {view === 'management' ? <ManagementDashboard /> : <AgentDashboard />}
    </div>
  );
}
