'use client';

import React from 'react';
import { AppNavBar } from '@/components/app-navbar';
import { CommandPalette } from '@/components/command-palette';
import { OfflineIndicator } from '@/components/offline-indicator';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNavBar />
      <OfflineIndicator />
      <CommandPalette />
      <main className="px-4 md:px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
