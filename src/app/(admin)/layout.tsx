
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNavBar } from '@/components/app-navbar';
import { AnimatedGradient } from '@/components/animated-gradient';
import { AppUser } from '@/lib/contracts';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            const isAdmin = data.user.roles.some((r: string) => r === "admin");
            if (!isAdmin) {
              router.replace('/agent');
              return;
            }
            setUser(data.user);
          } else {
            router.replace('/login');
            return;
          }
        } else {
          router.replace('/login');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        router.replace('/login');
        return;
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
  }, [router]);

  if (isLoading) {
    return (
      <>
        <AnimatedGradient />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      </>
    );
  }

  if (!user) return null;

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
