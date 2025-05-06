'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    // Footer element spans full width, applies background/border
    <footer className="border-t bg-background w-full">
      {/* Inner div acts as the container, centering and padding content */}
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 px-4 md:px-6">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary hidden md:inline-block">
              <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
            </svg>
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for fun. © {currentYear} KPI Quest. All rights reserved.
          </p>
        </div>
        {/* Add social links or other footer content here if needed */}
        {/* <nav className="flex gap-4 sm:gap-6">
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy</Link>
        </nav> */}
      </div>
    </footer>
  );
}
