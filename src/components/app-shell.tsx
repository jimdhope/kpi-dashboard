import { AppUser } from "@/lib/contracts";
import { AppNavBar } from "@/components/app-navbar";

interface AppShellProps {
  user: AppUser | null;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AppShell({ user, title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* V2 Ported Top Navigation */}
      <AppNavBar user={user} />

      {/* Main Content Area */}
      <main className="flex-1 w-full p-4 md:p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-2">{description}</p>
        </header>
        
        <div className="mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
