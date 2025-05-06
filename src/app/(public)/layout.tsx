'use client';
import React from 'react';
import { Header } from '@/components/landing-header';
import { Footer } from '@/components/landing-footer';
import { cn } from '@/lib/utils';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen"> {/* Changed to relative, min-h-screen */}
      {/* Fixed Background Container */}
      <div
        className={cn(
          "fixed inset-0 z-[-1]", // Fixed position, behind content
          "bg-gradient-to-br from-primary/10 via-background to-background-end", // Apply gradient
          "bg-cover bg-center" // Cover area, center it
        )}
      />

      {/* Scrollable Content Container */}
      <div className="relative z-[1] h-screen overflow-y-auto"> {/* Changed to h-screen, overflow-y-auto */}
        <Header />
        {/* Main content area within the scrollable container */}
        <main className="w-full"> {/* Removed flex-grow as height is managed by container */}
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
