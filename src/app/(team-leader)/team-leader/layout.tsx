'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Home, Trophy, Target, BarChart3, Gamepad2, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppNavBar } from '@/components/app-navbar';

interface RoleLayoutProps {
  children: React.ReactNode;
}

const roleMenuItems = [
  { label: 'Dashboard', href: '/team-leader', icon: Home },
];

export default function TeamLeaderLayout({ children }: RoleLayoutProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex relative min-h-screen w-full flex-col">
        <AppNavBar />
        
        <div className="flex flex-1">
          <Sidebar className="glass-sidebar border-r border-glass-border/40 pt-0 top-[65px] h-[calc(100vh-65px)]">
            <SidebarContent className="pt-4">
              <div className="px-4 mb-4">
                <h3 className="text-sm font-semibold">Team Leader</h3>
              </div>
              <SidebarMenu>
                {roleMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link href={item.href}>
                        <SidebarMenuButton 
                          isActive={active}
                          className={cn(
                            "mb-1",
                            active && "bg-primary/20 text-primary border-l-2 border-primary"
                          )}
                        >
                          <Icon className={cn("w-4 h-4", active ? "text-primary" : "")} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>

              <SidebarSeparator className="my-4" />

              <div className="px-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Quick Links</p>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Link href="/competitions">
                      <SidebarMenuButton>
                        <Trophy className="w-4 h-4" />
                        <span>Competitions</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/trackers">
                      <SidebarMenuButton>
                        <Target className="w-4 h-4" />
                        <span>Trackers</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/performance">
                      <SidebarMenuButton>
                        <BarChart3 className="w-4 h-4" />
                        <span>Performance</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 p-6 overflow-y-auto min-h-[calc(100vh-65px)]">
            <div className="glass-card p-6 rounded-xl min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
