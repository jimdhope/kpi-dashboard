'use client';

import React from 'react';
import { AppNavBar } from '@/components/app-navbar';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CommandPalette } from '@/components/command-palette';

interface AgentLayoutProps {
  children: React.ReactNode;
}

export default function AgentLayout({ children }: AgentLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppNavBar />
      <CommandPalette />
      <Breadcrumbs />
      <main className="px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
