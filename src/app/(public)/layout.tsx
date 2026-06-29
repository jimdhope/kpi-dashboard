
'use client';

import React from 'react';
import { AnimatedGradient } from '@/components/animated-gradient';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AnimatedGradient />
      <div className="min-h-screen">
        {children}
      </div>
    </>
  );
}
