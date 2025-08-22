
import React from 'react';

// This layout file is now named dashboard-settings-layout.tsx
// It ensures that the content of the dashboard settings page is correctly placed within the admin layout.
export default function DashboardSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
