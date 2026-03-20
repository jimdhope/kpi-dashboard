'use client';

import React from 'react';
import { AppNavBar } from '@/components/app-navbar';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CommandPalette } from '@/components/command-palette';
import { OfflineIndicator } from '@/components/offline-indicator';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex relative min-h-screen w-full flex-col">
      <AppNavBar />
      <OfflineIndicator />
      <CommandPalette />
      <Breadcrumbs />
      <main className="flex-1 px-6 pb-6 overflow-y-auto min-h-[calc(100vh-65px)]">
        <div className="glass-card p-6 rounded-xl min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
