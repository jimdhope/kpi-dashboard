'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Settings as SettingsIcon, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { OfflineIndicator } from '@/components/offline-indicator';
import type { AppUser, UserRole } from '@/services/user';

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
  { label: 'Campaigns', href: '/settings/campaigns', icon: Megaphone },
  { label: 'Pods', href: '/settings/pods', icon: ShieldCheck },
  { label: 'Users', href: '/settings/users', icon: Users },
];

const rolesWithSettingsAccess: UserRole[] = [
  'admin',
  'campaignManager',
  'podManager',
  'teamLeader',
  'competitionRunner',
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(getAuth(app), (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          }
          setIsLoading(false);
        });
        return () => unsubscribeUser();
      } else {
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && pathname === '/settings') {
      router.replace('/settings/general');
    }
  }, [isLoading, pathname, router]);

  const userRoles = currentUser?.roles as UserRole[] || [];
  const hasSettingsAccess = userRoles.some(role => rolesWithSettingsAccess.includes(role));

  if (isLoading) {
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
