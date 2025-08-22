'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export function StaticBackground() {
  return (
    <div
      aria-hidden="true" // Decorative element
      className={cn(
        'fixed inset-0 -z-10 overflow-hidden',
        // Main gradient layer
        'bg-gradient-to-b from-[hsl(var(--background-gradient-start))] to-[hsl(var(--background))]'
      )}
    >
        {/* Decorative, blurred shapes - Increased opacity from 0.08 to 0.15 */}
        <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(var(--primary-rgb),0.15),rgba(255,255,255,0))]"></div>
        <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(var(--primary-rgb),0.15),rgba(255,255,255,0))]"></div>
    </div>
  );
}
