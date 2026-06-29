
'use client';

import React, { useEffect, useState } from 'react';
import { AppNavBar } from '@/components/app-navbar';
import { AnimatedGradient } from '@/components/animated-gradient';
import { AppUser } from '@/lib/contracts';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
  }, []);

  return (
    <>
      <AnimatedGradient />
      <div className="min-h-screen">
        <AppNavBar user={user} />
        <main className="px-4 md:px-6 pb-6">
          {children}
        </main>
      </div>
    </>
  );
}
