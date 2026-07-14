'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNavBar, type NavItemConfig } from '@/components/app-navbar';
import type { NavDropdownItem } from '@/components/nav-dropdown';
import { AnimatedGradient } from '@/components/animated-gradient';
import { AppUser } from '@/lib/contracts';
import {
  BookMarked, BookOpen, Contact,
  Gamepad2,
  Wrench, Phone, BookOpen as BookOpenIcon,
  CalendarDays, Zap, Flame, Infinity, BarChartBig, FileCheck2,
} from 'lucide-react';

const AGENT_NAV_ITEMS: NavItemConfig[] = [
  {
    key: 'knowledgeBase',
    label: 'Knowledge Base',
    href: '/knowledge-base',
    icon: BookMarked,
    items: [
      { label: 'Browse Articles', href: '/knowledge-base', icon: BookOpen },
      { label: 'Directory', href: '/directory', icon: Contact },
    ] as NavDropdownItem[],
  },
  {
    key: 'miniGames',
    label: 'Mini Games',
    href: '/mini-games',
    icon: Gamepad2,
    items: [
      { label: 'RPS Game', href: '/mini-games/rps', icon: Gamepad2 },
    ] as NavDropdownItem[],
  },
  {
    key: 'usefulTools',
    label: 'Tools',
    href: '/tools',
    icon: Wrench,
    items: [
      { label: 'Call Flow', href: '/call-flow', icon: Phone, openInNewTab: true },
      { label: 'Meter Reading Guide', href: '/meter-reading-guide', icon: BookOpenIcon },
      { label: 'Instalment Plan', href: '/tools/instalment-plan', icon: CalendarDays },
      { label: 'Energy Usage', href: '/tools/energy-usage', icon: Zap },
      { label: 'Burns Test', href: '/tools/burns-test', icon: Flame },
      { label: 'Dual Fuel', href: '/tools/dual-fuel', icon: Infinity },
      { label: 'Tariff Comparison', href: '/tools/tariff-comparison', icon: BarChartBig },
      { label: 'Agreed Reads', href: '/tools/agreed-reads', icon: FileCheck2 },
    ] as NavDropdownItem[],
  },
];

export default function AgentLayout({
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
        <AppNavBar user={user} items={AGENT_NAV_ITEMS} />
        <main className="px-4 md:px-6 pb-6">
          {children}
        </main>
      </div>
    </>
  );
}
