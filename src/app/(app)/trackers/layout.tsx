'use client';

import React from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Home, Settings, CheckSquare } from 'lucide-react';

interface TrackersLayoutProps {
  children: React.ReactNode;
}

const trackersMenuItems = [
  { label: 'Dashboard', href: '/trackers', icon: Home },
  { label: 'Setup Trackers', href: '/trackers/setup', icon: Settings },
  { label: 'Log Scores', href: '/trackers/log', icon: CheckSquare },
];

export default function TrackersLayout({ children }: TrackersLayoutProps) {
  return (
    <div className="flex relative min-h-screen w-full flex-col">
      {/* Breadcrumbs with section navigation - shown on mobile */}
      <Breadcrumbs 
        sectionItems={trackersMenuItems}
        className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b md:hidden"
      />
      <main className="flex-1 px-4 md:px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
