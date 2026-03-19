'use client';

import React from 'react';
import { AppNavBar } from '@/components/app-navbar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex relative min-h-screen w-full flex-col">
      <AppNavBar />
      <main className="flex-1 p-6 overflow-y-auto min-h-[calc(100vh-65px)]">
        <div className="glass-card p-6 rounded-xl min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
