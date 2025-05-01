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
  SidebarSeparator, // Keep SidebarSeparator import if used elsewhere
} from '@/components/ui/sidebar';
import { Home, Users, BarChart3, Settings, Trophy, Megaphone, ShieldCheck, UsersRound, Award } from 'lucide-react'; // Import Award icon
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle'; // Import ThemeToggle

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
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
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" tooltip="Dashboard" isActive>
                <Home />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Removed SidebarSeparator here */}

             <SidebarGroup>
              <SidebarGroupLabel>Competitions</SidebarGroupLabel>
              <SidebarMenuItem>
                <SidebarMenuButton href="#" tooltip="Competitions">
                  <Trophy />
                  <span>Competitions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton href="#" tooltip="Achievements">
                  <Award /> {/* Added Award icon */}
                  <span>Achievements</span> {/* Added Achievements link */}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton href="#" tooltip="Teams">
                  <Users />
                  <span>Teams</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
               <SidebarMenuItem>
                <SidebarMenuButton href="#" tooltip="Campaigns">
                  <Megaphone />
                  <span>Campaigns</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton href="#" tooltip="Pods">
                   <ShieldCheck />
                  <span>Pods</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton href="#" tooltip="Users">
                  <UsersRound />
                  <span>Users</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarGroup>
               <SidebarGroupLabel>Analytics</SidebarGroupLabel>
               <SidebarMenuItem>
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
              <AvatarImage src="https://picsum.photos/100/100" alt="User Avatar" data-ai-hint="user avatar" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">User Name</p>
              <p className="text-xs text-muted-foreground truncate">user.email@example.com</p>
            </div>
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
              <h2 className="text-lg font-semibold hidden md:block">Dashboard Overview</h2> {/* Hide on small screens */}
            </div>
            <div className="flex items-center gap-4"> {/* Right side content */}
               <ThemeToggle /> {/* Add Theme Toggle button */}
            </div>
          </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
