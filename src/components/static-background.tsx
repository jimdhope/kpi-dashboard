
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function StaticBackground() {
  return (
    <div
      className={cn(
        'fixed inset-0 -z-10',
        'bg-gradient-to-b from-[hsl(var(--background-gradient-start))] to-[hsl(var(--background))]'
      )}
    />
  );
}
