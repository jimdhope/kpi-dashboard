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
        "flex flex-col min-h-screen bg-cover bg-fixed bg-center"
      )}
      style={{
        backgroundImage: "url('https://picsum.photos/1920/1080')",
      }}
      data-ai-hint="abstract background"
    >
      <Header />
      <main className="flex-grow w-full">{children}</main>
      <Footer />
    </div>
  );
}
