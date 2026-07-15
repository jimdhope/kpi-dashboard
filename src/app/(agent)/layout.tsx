import { redirect } from "next/navigation";
import type { NavItemConfig } from '@/components/app-navbar';
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import type { NavDropdownItem } from '@/components/nav-dropdown';
import { authService } from "@/server/services/auth-service";
import {
  BookMarked, BookOpen, Contact,
  Gamepad2, ArrowUpDown, Grid3X3, WholeWord,
  Wrench, Phone, BookOpen as BookOpenIcon,
  CalendarDays, Zap, Flame, Infinity, BarChartBig, FileCheck2,
} from 'lucide-react';

const AGENT_NAV_ITEMS: NavItemConfig[] = [
  {
    key: 'knowledgeBase',
    label: 'Knowledge Base',
    href: '/knowledge-base',
    icon: BookMarked,
    items: [
      { label: 'Browse Articles', href: '/knowledge-base', icon: BookOpen },
      { label: 'Directory', href: '/directory', icon: Contact },
    ] as NavDropdownItem[],
  },
  {
    key: 'miniGames',
    label: 'Mini Games',
    href: '/mini-games',
    icon: Gamepad2,
    items: [
      { label: 'RPS Game', href: '/mini-games/rps', icon: Gamepad2 },
      { label: 'Higher or Lower', href: '/mini-games/higher-lower', icon: ArrowUpDown },
      { label: 'Daily Word', href: '/mini-games/daily-word', icon: WholeWord },
      { label: 'Daily Sudoku', href: '/mini-games/sudoku', icon: Grid3X3 },
    ] as NavDropdownItem[],
  },
  {
    key: 'usefulTools',
    label: 'Tools',
    href: '/tools',
    icon: Wrench,
    items: [
      { label: 'Call Flow', href: '/call-flow', icon: Phone, openInNewTab: true },
      { label: 'Meter Reading Guide', href: '/meter-reading-guide', icon: BookOpenIcon },
      { label: 'Instalment Plan', href: '/tools/instalment-plan', icon: CalendarDays },
      { label: 'Energy Usage', href: '/tools/energy-usage', icon: Zap },
      { label: 'Burns Test', href: '/tools/burns-test', icon: Flame },
      { label: 'Dual Fuel', href: '/tools/dual-fuel', icon: Infinity },
      { label: 'Tariff Comparison', href: '/tools/tariff-comparison', icon: BarChartBig },
      { label: 'Agreed Reads', href: '/tools/agreed-reads', icon: FileCheck2 },
    ] as NavDropdownItem[],
  },
];

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  return (
    <AuthenticatedShell user={session.user} items={AGENT_NAV_ITEMS} showCommandPalette={false}>
      {children}
    </AuthenticatedShell>
  );
}
