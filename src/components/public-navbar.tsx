'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { AppLogo } from './app-logo';

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center w-full">
        <div className="container mx-auto flex items-center justify-between px-4 md:px-6">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <AppLogo className="w-6 h-6 text-primary" />
            <span className="font-bold sm:inline-block">KPI Quest</span>
          </Link>
          <nav className="flex items-center space-x-4">
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
