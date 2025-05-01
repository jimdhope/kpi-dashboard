'use client';
import React from 'react';
import { DashboardLayout } from '@/components/dashboard-layout'; // Reuse existing layout

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
