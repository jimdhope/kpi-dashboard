'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Settings as SettingsIcon, Megaphone, ShieldCheck, Users, MessageSquare, Zap, Calendar, Database, Download, Hash, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineIndicator } from '@/components/offline-indicator';
import { usePermissions } from '@/hooks/use-permissions';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  label: string;
  href: string;
  icon: typeof SettingsIcon;
}

const settingsMenuItems: MenuItem[] = [
  { label: 'General', href: '/settings/general', icon: SettingsIcon },
  { label: 'Data Import', href: '/settings/data-import', icon: Database },
  { label: 'Backup', href: '/settings/backup', icon: Download },
  { label: 'Hashtag Scores', href: '/settings/score-targets', icon: Hash },
  { label: 'Teams', href: '/settings/teams/channels', icon: MessageSquare },
  { label: 'Automations', href: '/settings/teams/automations', icon: Zap },
  { label: 'Scheduled', href: '/settings/teams/scheduled', icon: Calendar },
  { label: 'Campaigns', href: '/settings/campaigns', icon: Megaphone },
  { label: 'Pods', href: '/settings/pods', icon: ShieldCheck },
  { label: 'Users', href: '/settings/users', icon: Users },
  { label: 'Permissions', href: '/settings/permissions', icon: Shield },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<{ id: string; roles?: { key: string }[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  const roleKeys = currentUser?.roles?.map((r) => r.key) || [];
  const { getNavLevel, isLoading: permsLoading } = usePermissions(roleKeys);
  const hasSettingsAccess = !permsLoading && getNavLevel('settings') === 'MANAGE';

  useEffect(() => {
    if (!isLoading && pathname === '/settings') {
      router.replace('/settings/general');
    }
  }, [isLoading, pathname, router]);

  if (isLoading || permsLoading) {
    return (
      <div className="flex relative min-h-screen w-full flex-col">
        {/* Mobile breadcrumbs */}
        <Breadcrumbs 
          sectionItems={settingsMenuItems}
          className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b md:hidden"
        />
        <div className="flex-1 px-4 md:px-6 pb-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!hasSettingsAccess) {
    return (
      <div className="flex relative min-h-screen w-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">You do not have access to settings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex relative min-h-screen w-full flex-col">
      <OfflineIndicator />
      {/* Breadcrumbs with section navigation - shown on mobile */}
      <Breadcrumbs 
        sectionItems={settingsMenuItems}
        className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b md:hidden"
      />
      <main className="flex-1 px-4 md:px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
