
import React from 'react';
import { DashboardLayout } from '@/components/dashboard-layout'; // Reuse existing layout

// This layout applies to all routes under /admin
// No role checking needed here specifically, assumed user reaching this has admin access
// The broader layout (e.g., ProfileLayout or potentially a root middleware) should handle initial access control.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
