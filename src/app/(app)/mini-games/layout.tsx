import { Breadcrumbs } from '@/components/breadcrumbs';
import { Home, Gamepad2, ArrowUpDown, Grid3X3, WholeWord } from 'lucide-react';
import { OfflineIndicator } from '@/components/offline-indicator';

interface MiniGamesLayoutProps {
  children: React.ReactNode;
}

const miniGamesMenuItems = [
  { label: 'Dashboard', href: '/mini-games', icon: Home },
  { label: 'RPS Game', href: '/mini-games/rps', icon: Gamepad2 },
  { label: 'Higher or Lower', href: '/mini-games/higher-lower', icon: ArrowUpDown },
  { label: 'Daily Word', href: '/mini-games/daily-word', icon: WholeWord },
  { label: 'Daily Sudoku', href: '/mini-games/sudoku', icon: Grid3X3 },
];

export default function MiniGamesLayout({ children }: MiniGamesLayoutProps) {
  return (
    <div className="flex relative min-h-screen w-full flex-col">
      <OfflineIndicator />
      {/* Breadcrumbs with section navigation - shown on mobile */}
      <Breadcrumbs 
        sectionItems={miniGamesMenuItems}
        className="sticky top-[65px] z-40 bg-background/95 backdrop-blur-sm border-b md:hidden"
      />
      <main className="flex-1 px-4 md:px-6 pb-6">
        {children}
      </main>
    </div>
  );
}
