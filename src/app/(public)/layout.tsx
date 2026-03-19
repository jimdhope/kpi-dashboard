'use client';
import React from 'react';
import { PublicNavbar } from '@/components/public-navbar';
import { Footer } from '@/components/landing-footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <PublicNavbar />
      <main className="flex-1 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
