import "@/app/globals.css";
import { ReactNode } from "react";
import { AnimatedGradient } from "@/components/animated-gradient";

export const metadata = {
  title: "KPI Quest - Gamify Your Team's Performance",
  description: "Transform KPI tracking into friendly competition. Track metrics, compete with colleagues, and celebrate wins together.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <AnimatedGradient />
        {children}
      </body>
    </html>
  );
}
