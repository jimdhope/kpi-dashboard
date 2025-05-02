
'use client';
import React from 'react';
import Link from 'next/link'; // Import Link
import { usePathname } from 'next/navigation'; // Import usePathname
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Home, Award, Settings } from 'lucide-react'; // Icons for agent view
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle'; // Import ThemeToggle
import { Button } from '@/components/ui/button'; // Import Button for Logout
import { getAuth } from 'firebase/auth'; // Import getAuth for Logout
import { app } from '@/lib/firebase'; // Import app for Logout
import { generateInitials } from '@/lib/utils'; // Import generateInitials

interface AgentSidebarLayoutProps {
  children: React.ReactNode;
}

// TODO: Replace with actual user data from auth context
const MOCK_AGENT_USER = {
    name: "Agent Charlie",
    email: "charlie.agent@kpiquest.com",
    avatarUrl: "https://picsum.photos/seed/charlie_b/100",
    avatarInitials: '', // Example: Add if needed
    avatarBgColor: '', // Example: Add if needed
};

export function AgentSidebarLayout({ children }: AgentSidebarLayoutProps) {
  const currentPath = usePathname(); // Get current route

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
              <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
            </svg>
            <h1 className="text-xl font-semibold">KpiQuest</h1>
             <span className="text-xs text-muted-foreground ml-1">(Agent)</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-4">
          <SidebarMenu>
            <SidebarMenuItem>
               {/* Use Link for navigation, pass href, set isActive */}
              <Link href="/agent" passHref>
                <SidebarMenuButton tooltip="Dashboard" isActive={currentPath === '/agent'}>
                  <Home />
                  <span>My Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
               {/* Use Link for navigation */}
               <Link href="/agent/achievements" passHref>
                  <SidebarMenuButton tooltip="Achievements" isActive={currentPath === '/agent/achievements'}>
                    <Award />
                    <span>My Achievements</span>
                  </SidebarMenuButton>
               </Link>
            </SidebarMenuItem>
             {/* Add other agent-specific links here if needed */}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {MOCK_AGENT_USER.avatarUrl ? (
                 <AvatarImage src={MOCK_AGENT_USER.avatarUrl} alt="User Avatar" data-ai-hint="agent avatar" />
              ) : null}
              <AvatarFallback
                 initials={MOCK_AGENT_USER.avatarInitials || generateInitials(MOCK_AGENT_USER.name)}
                 backgroundColor={MOCK_AGENT_USER.avatarBgColor}
               >
                   {!MOCK_AGENT_USER.avatarInitials && generateInitials(MOCK_AGENT_USER.name)}
               </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{MOCK_AGENT_USER.name}</p>
              <p className="text-xs text-muted-foreground truncate">{MOCK_AGENT_USER.email}</p>
            </div>
             {/* TODO: Link to agent settings page */}
            <Link href="#" passHref> {/* Update href later */}
                <SidebarMenuButton tooltip="Settings" size="sm" variant="ghost" className="ml-auto" isActive={currentPath === '/agent/settings'}> {/* Update isActive path later */}
                    <Settings />
                </SidebarMenuButton>
            </Link>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
         <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              {/* TODO: Make header title dynamic based on current page */}
              <h2 className="text-lg font-semibold hidden md:block">My Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
               <ThemeToggle />
               {/* Logout Button for Agent */}
               <Button variant="outline" size="sm" onClick={() => getAuth(app).signOut().then(() => window.location.href = '/login')}>Logout</Button>
            </div>
          </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
