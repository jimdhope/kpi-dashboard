import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed GeistMono as it was causing an error and potentially not needed
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import { ThemeProvider } from "@/components/theme-provider"; // Import ThemeProvider

export const metadata: Metadata = {
  title: 'KpiQuest',
  description: 'Track KPI achievements and gamify progress.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning> {/* Add suppressHydrationWarning for next-themes */}
      <body className={`${GeistSans.variable} antialiased`}> {/* Removed GeistMono variable */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster /> {/* Add Toaster component here */}
        </ThemeProvider>
      </body>
    </html>
  );
}
