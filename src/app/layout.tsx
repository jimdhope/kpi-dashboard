import "@/app/globals.css";
import { ReactNode } from "react";
import { AtmosphericBackground } from "@/components/atmospheric-background";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata = {
  title: "KPI Quest - Gamify Your Team's Performance",
  description: "Transform KPI tracking into friendly competition. Track metrics, compete with colleagues, and celebrate wins together.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <TooltipProvider>
          <AtmosphericBackground />
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
