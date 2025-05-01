'use client';
import React from 'react';
import { AgentSidebarLayout } from '@/components/agent-sidebar-layout'; // Create this specific layout

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AgentSidebarLayout>{children}</AgentSidebarLayout>;
}
