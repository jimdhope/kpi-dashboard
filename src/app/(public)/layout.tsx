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
      {/* Fixed Background Container - Apply new subtle background class */}
      <div
        className={cn(
          "fixed-background-container", // Use the dedicated class for positioning
          "subtle-geometric-background" // Apply the new pattern background
        )}
      />

      {/* Scrollable Content Container */}
      <div className="scrollable-content-container"> {/* Use the dedicated class */}
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
