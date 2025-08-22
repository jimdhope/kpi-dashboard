'use client';
import React from 'react';
import { Header } from '@/components/landing-header';
import { Footer } from '@/components/landing-footer';
import { cn } from '@/lib/utils';
import { StaticBackground } from '@/components/static-background'; // Import the new static background

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      {/* Fixed Background Container */}
      <div
        className="fixed-background-container"
      >
        <StaticBackground /> {/* Render the static background */}
      </div>

      {/* Scrollable Content Container */}
      <div className="scrollable-content-container">
        <Header />
        <main className="w-full">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
