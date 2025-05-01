'use client';
import React from 'react';
import { Header } from '@/components/landing-header'; // Create this component later
import { Footer } from '@/components/landing-footer'; // Create this component later

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
