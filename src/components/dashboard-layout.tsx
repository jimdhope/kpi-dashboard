import React from 'react';
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
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Home, Users, BarChart3, Settings, Trophy, Megaphone, ShieldCheck, UsersRound, Award, CheckSquare } from 'lucide-react'; // Added CheckSquare
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle'; // Import ThemeToggle
import { Button } from '@/components/ui/button'; // Import Button
import { getAuth } from 'firebase/auth'; // Import getAuth
import { app } from '@/lib/firebase'; // Import app

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// TODO: Replace with actual admin user data from auth context
const MOCK_ADMIN_USER = {
    name: "Admin User",
    email: "admin@kpiquest.com",
    avatar: "https://picsum.photos/seed/admin/100" // Generic admin avatar
};


export function DashboardLayout({ children }: DashboardLayoutProps) {
  // TODO: Get current route to set active state dynamically
  const currentPath = '/admin'; // Placeholder

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
             <span className="text-xs text-muted-foreground ml-1">(Admin)</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/admin" tooltip="Dashboard" isActive={currentPath === '/admin'}>
                <Home />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

             <SidebarGroup>
              <SidebarGroupLabel>Competitions</SidebarGroupLabel>
              <SidebarMenuItem>
                 {/* TODO: Update href when competition page exists */}
                <SidebarMenuButton href="#" tooltip="Competitions">
                  <Trophy />
                  <span>Competitions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                {/* TODO: Update href when teams page exists */}
                <SidebarMenuButton href="#" tooltip="Teams">
                  <Users />
                  <span>Teams</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
                <SidebarMenuItem>
                <SidebarMenuButton href="/admin/achievements" tooltip="Achievements Log" isActive={currentPath === '/admin/achievements'}>
                  <CheckSquare /> {/* Changed icon */}
                  <span>Achievements Log</span> {/* Changed text */}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
               <SidebarMenuItem>
                 {/* TODO: Update href when campaigns page exists */}
                <SidebarMenuButton href="#" tooltip="Campaigns">
                  <Megaphone />
                  <span>Campaigns</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                 {/* TODO: Update href when pods page exists */}
                <SidebarMenuButton href="#" tooltip="Pods">
                   <ShieldCheck />
                  <span>Pods</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                 {/* TODO: Update href when users page exists */}
                <SidebarMenuButton href="#" tooltip="Users">
                  <UsersRound />
                  <span>Users</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarGroup>
               <SidebarGroupLabel>Analytics</SidebarGroupLabel>
               <SidebarMenuItem>
                {/* TODO: Update href when reports page exists */}
                 <SidebarMenuButton href="#" tooltip="KPI Reports">
                  <BarChart3 />
                  <span>KPI Reports</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
             </SidebarGroup>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={MOCK_ADMIN_USER.avatar} alt="Admin Avatar" data-ai-hint="admin avatar" />
              <AvatarFallback>{MOCK_ADMIN_USER.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{MOCK_ADMIN_USER.name}</p>
              <p className="text-xs text-muted-foreground truncate">{MOCK_ADMIN_USER.email}</p>
            </div>
            {/* TODO: Link to admin settings page */}
            <SidebarMenuButton href="#" tooltip="Settings" size="sm" variant="ghost" className="ml-auto">
              <Settings />
            </SidebarMenuButton>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
         <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background md:px-6">
            <div className="flex items-center gap-2"> {/* Wrapper div */}
              <SidebarTrigger className="md:hidden" />
              {/* TODO: Make header title dynamic */}
              <h2 className="text-lg font-semibold hidden md:block">Admin Dashboard</h2>
            </div>
            <div className="flex items-center gap-4"> {/* Right side content */}
               <ThemeToggle /> {/* Add Theme Toggle button */}
                {/* TODO: Add Logout Button */}
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
