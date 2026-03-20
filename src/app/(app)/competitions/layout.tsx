'use client';

import React from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Home, Trophy, Award, CheckSquare } from 'lucide-react';

interface CompetitionsLayoutProps {
  children: React.ReactNode;
}

const competitionsMenuItems = [
  { label: 'Dashboard', href: '/competitions', icon: Home },
  { label: 'Log Scores', href: '/competitions/log', icon: CheckSquare },
  { label: 'Manage', href: '/competitions/manage', icon: Trophy },
  { label: 'Certificates', href: '/competitions/certificates', icon: Award },
];

export default function CompetitionsLayout({ children }: CompetitionsLayoutProps) {
  return (
    <div className="flex relative min-h-screen w-full flex-col">
      {/* Breadcrumbs with section navigation - shown on mobile */}
      <Breadcrumbs 
        sectionItems={competitionsMenuItems}
        className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b md:hidden"
      />
      <main className="flex-1 px-4 md:px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
