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
    // Ensure the outer div takes full height and uses flex column layout
    <div className="flex flex-col min-h-screen">
      <Header />
      {/* Ensure main takes up remaining space and allows content to manage its width */}
      <main className="flex-grow w-full">{children}</main>
      <Footer />
    </div>
  );
}
