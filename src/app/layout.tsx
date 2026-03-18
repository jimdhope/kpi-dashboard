import type { Metadata } from 'next';
// Removed Geist Sans import
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import { ThemeProvider } from "@/components/theme-provider"; // Import ThemeProvider

export const metadata: Metadata = {
  title: 'KPI Quest',
  description: 'Track KPI achievements and gamify progress.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Removed GeistSans.variable from body className */}
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >{children}<Toaster /></ThemeProvider>
      </body>
    </html>
  );
}
