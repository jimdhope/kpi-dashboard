// This file can be left empty or used for specific layout needs for the achievements section if necessary.
// The main admin layout is handled by /admin/layout.tsx
import React from 'react';

export default function AdminAchievementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>; // Pass children through, main layout applies
}