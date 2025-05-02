
'use client';
import React from 'react';
import { DashboardLayout } from '@/components/dashboard-layout'; // For Admin/Manager view
import { AgentSidebarLayout } from '@/components/agent-sidebar-layout'; // For Agent view

// TODO: Implement logic to determine user role (e.g., from auth context/claims)
function getUserRole(): 'admin' | 'agent' | null {
  // Replace with actual role detection logic
  // This is a placeholder - assume admin for now
  return 'admin';
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = getUserRole();

  // Conditionally render the correct layout based on role
  if (role === 'admin') { // Add checks for other roles like podManager, teamLeader if they have different layouts
    return <DashboardLayout>{children}</DashboardLayout>;
  } else if (role === 'agent') {
    return <AgentSidebarLayout>{children}</AgentSidebarLayout>;
  } else {
    // Handle case where role is unknown or user is not logged in
    // Maybe redirect to login or show an error/default layout
    return <div>Error: Could not determine user role for layout.</div>;
  }
}
