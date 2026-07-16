import "@/app/globals.css";
import { ReactNode } from "react";
import { AtmosphericBackground } from "@/components/atmospheric-background";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "KPI Quest - Gamify Your Team's Performance",
  description: "Transform KPI tracking into friendly competition. Track metrics, compete with colleagues, and celebrate wins together.",
  applicationName: "KPI Quest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KPI Quest",
  },
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2931",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <PwaProvider>
          <TooltipProvider>
            <AtmosphericBackground />
            {children}
            <Toaster />
          </TooltipProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
