'use client';

import React from 'react';
import { AppNavBar } from '@/components/app-navbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNavBar />
      <main>
        {children}
      </main>
    </div>
  );
}
