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
    // The main div no longer needs relative positioning if the background is on the body
    <div className="flex flex-col min-h-screen">
      {/* The background is now handled globally in globals.css */}
      <Header />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
