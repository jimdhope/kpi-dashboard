// src/app/(public)/layout.tsx
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
    <div
      className={cn(
        "flex flex-col min-h-screen",
        "bg-gradient-to-br from-primary/10 via-background to-background-end", // Apply gradient
        "bg-fixed bg-cover bg-center" // Make background fixed, cover the area, and center it
      )}
    >
      <Header />
      {/* Ensure main content area can scroll independently if needed */}
      <main className="flex-grow w-full">{children}</main>
      <Footer />
    </div>
  );
}
