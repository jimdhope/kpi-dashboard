'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle'; // Assuming you have this

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 md:px-6">
        <Link href="/" className="mr-6 flex items-center space-x-2">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
              <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
            </svg>
          <span className="font-bold sm:inline-block">KpiQuest</span>
        </Link>
        <nav className="flex flex-1 items-center justify-end space-x-4">
          {/* Add navigation links here if needed later */}
           <ThemeToggle />
           <Link href="/login" passHref>
              <Button variant="outline" size="sm">Login</Button>
           </Link>
        </nav>
      </div>
    </header>
  );
}
