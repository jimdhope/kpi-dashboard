'use client';
import React from 'react';
import { Header } from '@/components/landing-header';
import { Footer } from '@/components/landing-footer';
import { cn } from '@/lib/utils';
import { AnimatedSvgBackground } from '@/components/animated-svg-background'; // Import the animated background

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
        <AnimatedSvgBackground /> {/* Render the animated SVG background */}
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
