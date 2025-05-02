
import React from 'react';
import { AgentSidebarLayout } from '@/components/agent-sidebar-layout'; // Create this specific layout

// This layout applies to all routes under /agent
// No role checking needed here specifically, assumed user reaching this has agent access
// The broader layout (e.g., ProfileLayout or potentially a root middleware) should handle initial access control.

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AgentSidebarLayout>{children}</AgentSidebarLayout>;
}
