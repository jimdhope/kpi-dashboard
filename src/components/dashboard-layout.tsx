
import React from 'react';
import Link from 'next/link'; // Import Link
import { usePathname } from 'next/navigation'; // Keep usePathname
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
import { Home, Users, BarChart3, Settings, Trophy, Megaphone, ShieldCheck, UsersRound, Award, CheckSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button'; // Import Button
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { generateInitials } from '@/lib/utils'; // Import generateInitials

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// TODO: Replace with actual admin user data from auth context
const MOCK_ADMIN_USER = {
    name: "Admin User",
    email: "admin@kpiquest.com",
    avatarUrl: "", // Keep empty if no URL
    avatarInitials: '', // Example: Add if needed
    avatarBgColor: '', // Example: Add if needed
};


export function DashboardLayout({ children }: DashboardLayoutProps) {
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
             <span className="text-xs text-muted-foreground ml-1">(Admin)</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              {/* Use Link for navigation, pass href to Link, set isActive based on currentPath */}
              <Link href="/admin" passHref>
                <SidebarMenuButton tooltip="Dashboard" isActive={currentPath === '/admin'}>
                  <Home />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                {/* Use Link for navigation */}
                <Link href="/admin/achievements" passHref>
                    <SidebarMenuButton tooltip="Achievements Log" isActive={currentPath === '/admin/achievements'}>
                      <CheckSquare />
                      <span>Achievements Log</span>
                    </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>

             <SidebarGroup>
              <SidebarGroupLabel>Competitions</SidebarGroupLabel>
              <SidebarMenuItem>
                 {/* TODO: Update href when competition page exists */}
                  <Link href="#" passHref> {/* Update href later */}
                    <SidebarMenuButton tooltip="Competitions" isActive={currentPath === '/admin/competitions'}> {/* Update isActive path later */}
                      <Trophy />
                      <span>Competitions</span>
                    </SidebarMenuButton>
                   </Link>
              </SidebarMenuItem>
               <SidebarMenuItem>
                {/* TODO: Update href when teams page exists */}
                 <Link href="#" passHref> {/* Update href later */}
                    <SidebarMenuButton tooltip="Teams" isActive={currentPath === '/admin/teams'}> {/* Update isActive path later */}
                      <Users />
                      <span>Teams</span>
                    </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
               <SidebarMenuItem>
                 <Link href="/admin/campaigns" passHref>
                    <SidebarMenuButton tooltip="Campaigns" isActive={currentPath === '/admin/campaigns'}>
                      <Megaphone />
                      <span>Campaigns</span>
                    </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                 <Link href="/admin/pods" passHref>
                    <SidebarMenuButton tooltip="Pods" isActive={currentPath === '/admin/pods'}>
                       <ShieldCheck />
                      <span>Pods</span>
                    </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                  <Link href="/admin/users" passHref>
                    <SidebarMenuButton tooltip="Users" isActive={currentPath === '/admin/users'}>
                      <UsersRound />
                      <span>Users</span>
                    </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarGroup>
               <SidebarGroupLabel>Analytics</SidebarGroupLabel>
               <SidebarMenuItem>
                {/* TODO: Update href when reports page exists */}
                  <Link href="#" passHref> {/* Update href later */}
                     <SidebarMenuButton tooltip="KPI Reports" isActive={currentPath === '/admin/reports'}> {/* Update isActive path later */}
                      <BarChart3 />
                      <span>KPI Reports</span>
                    </SidebarMenuButton>
                 </Link>
              </SidebarMenuItem>
             </SidebarGroup>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
               {/* AvatarFallback handles initials and background color */}
              <AvatarFallback
                   initials={MOCK_ADMIN_USER.avatarInitials || generateInitials(MOCK_ADMIN_USER.name)}
                   backgroundColor={MOCK_ADMIN_USER.avatarBgColor}
               >
                    {/* Render default initials only if no custom/generated */}
                   {!MOCK_ADMIN_USER.avatarInitials && generateInitials(MOCK_ADMIN_USER.name)}
               </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{MOCK_ADMIN_USER.name}</p>
              <p className="text-xs text-muted-foreground truncate">{MOCK_ADMIN_USER.email}</p>
            </div>
            {/* TODO: Link to admin settings page */}
            <Link href="#" passHref>
                <SidebarMenuButton tooltip="Settings" size="sm" variant="ghost" className="ml-auto" isActive={currentPath === '/admin/settings'}> {/* Update isActive path later */}
                    <Settings />
                </SidebarMenuButton>
            </Link>
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
