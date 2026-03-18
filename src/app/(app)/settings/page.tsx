'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Settings, Megaphone, ShieldCheck, MessageSquare, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const settingsSections = [
    {
      title: "Profile",
      description: "Manage your account profile and preferences",
      href: "/settings/profile",
      icon: User,
    },
    {
      title: "Notifications",
      description: "Configure email and push notification settings",
      href: "/settings/notifications",
      icon: Bell,
    },
    {
      title: "General",
      description: "App appearance and regional settings",
      href: "/settings/general",
      icon: Settings,
    },
  ];

  const managementSections = [
    {
      title: "Campaigns",
      description: "Manage campaigns and competitions",
      href: "/settings/campaigns",
      icon: Megaphone,
    },
    {
      title: "Pods",
      description: "Configure pods and team structures",
      href: "/settings/pods",
      icon: ShieldCheck,
    },
    {
      title: "Users",
      description: "Manage user accounts and roles",
      href: "/settings/users",
      icon: Users,
    },
    {
      title: "Dashboard Settings",
      description: "Configure dashboard displays and MOTD",
      href: "/settings/dashboard",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings</p>
      </div>

      {/* User Settings */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <Card variant="glass" className="glass-card-hover h-full cursor-pointer">
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{section.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Management Settings */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Management</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {managementSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <Card variant="glass" className="glass-card-hover h-full cursor-pointer">
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{section.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
