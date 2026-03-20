'use client';

import React from 'react';
import { AppNavBar } from '@/components/app-navbar';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CommandPalette } from '@/components/command-palette';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNavBar />
      <CommandPalette />
      <Breadcrumbs className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b" />
      <main className="px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
