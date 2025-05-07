'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle'; // Assuming you have this
import { AppLogo } from './app-logo'; // Import the new AppLogo component

export function Header() {
  return (
    // Header itself is full width, background/blur applied here
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* This div is now just for flex layout, takes full width */}
      <div className="flex h-14 items-center w-full">
        {/* This inner div acts as the container, centering content and adding padding */}
        <div className="container mx-auto flex items-center justify-between px-4 md:px-6">
            {/* Left side: Logo and App Name */}
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <AppLogo className="w-6 h-6 text-primary" />
              <span className="font-bold sm:inline-block">KPI Quest</span>
            </Link>
            {/* Right side: Navigation (Theme Toggle, Login) */}
            <nav className="flex items-center space-x-4">
              {/* Add navigation links here if needed later */}
              <ThemeToggle />
              <Link href="/login" passHref>
                  <Button variant="outline" size="sm">Login</Button>
              </Link>
            </nav>
        </div>
      </div>
    </header>
  );
}
