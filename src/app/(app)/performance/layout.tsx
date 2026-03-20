'use client';

import React from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Home, Settings, CheckSquare, BarChart3, LineChart } from 'lucide-react';

interface PerformanceLayoutProps {
  children: React.ReactNode;
}

const performanceMenuItems = [
  { label: 'Dashboard', href: '/performance', icon: Home },
  { label: 'Setup KPIs', href: '/performance/kpis', icon: Settings },
  { label: 'Log Scores', href: '/performance/log', icon: CheckSquare },
  { label: 'KPI Breakdown', href: '/performance/breakdown', icon: BarChart3 },
  { label: 'Performance Charts', href: '/performance/charts', icon: LineChart },
];

export default function PerformanceLayout({ children }: PerformanceLayoutProps) {
  return (
    <div className="flex relative min-h-screen w-full flex-col">
      {/* Breadcrumbs with section navigation - shown on mobile */}
      <Breadcrumbs 
        sectionItems={performanceMenuItems}
        className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b md:hidden"
      />
      <main className="flex-1 px-4 md:px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
