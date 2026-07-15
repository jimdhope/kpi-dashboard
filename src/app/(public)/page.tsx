import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Target, TrendingUp, Zap, CalendarDays, Calculator, 
  CheckCircle, BarChart3, Gamepad2, BookOpen, Wrench, Flame, 
  FileCheck2, Phone, Star, Award, Users, Shield, ArrowRight, Contact
} from 'lucide-react';

const toolFeatures = [
  {
    id: 'meter-reading',
    title: 'Meter Reading Guide',
    description: 'Comprehensive guide for reading all meter types',
    icon: BookOpen,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'instalment',
    title: 'Instalment Plan',
    description: 'Calculate payment plans for customer balances',
    icon: CalendarDays,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'energy',
    title: 'Energy Usage',
    description: 'Calculate usage and costs from meter readings',
    icon: Zap,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'burns-test',
    title: 'Burns Test',
    description: 'Validate 7-day meter readings for accuracy',
    icon: Flame,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'dual-fuel',
    title: 'Dual Fuel',
    description: 'Compare combined electricity and gas payments',
    icon: BarChart3,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'tariff',
    title: 'Tariff Comparison',
    description: 'Find the best tariff deals for customers',
    icon: Calculator,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'agreed-reads',
    title: 'Agreed Reads',
    description: 'Calculate agreed reads for billing periods',
    icon: FileCheck2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

const mainFeatures = [
  {
    id: 'directory',
    title: 'Directory',
    description: 'Manage contacts with searchable list, filters by type/company/department',
    icon: Users,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    stats: 'Contact management',
  },
  {
    id: 'knowledgebase',
    title: 'Knowledge Base',
    description: 'Create and browse articles with rich text editor, typed categories and tags',
    icon: BookOpen,
    color: 'text-purple',
    bgColor: 'bg-purple/10',
    stats: 'Article management',
  },
  {
    id: 'competitions',
    title: 'Competitions',
    description: 'Create KPI competitions with custom rules, leaderboards, and certificates',
    icon: Trophy,
    color: 'text-goldenrod',
    bgColor: 'bg-goldenrod/10',
    stats: 'Win weekly competitions',
  },
  {
    id: 'performance',
    title: 'Performance Tracking',
    description: 'Real-time dashboards, 6-week trends, and export-ready reports',
    icon: TrendingUp,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    stats: 'Track daily KPIs',
  },
  {
    id: 'minigames',
    title: 'Mini-Games',
    description: 'Daily word, number and Sudoku challenges plus Rock Paper Scissors',
    icon: Gamepad2,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    stats: 'Team fun',
  },
];

const highlights = [
  {
    title: 'Team Pods',
    description: 'Organize agents into teams with role-based access',
    icon: Users,
  },
  {
    title: 'Certificates',
    description: 'Download awards for top performers',
    icon: Award,
  },
  {
    title: 'Call Flow Guide',
    description: 'Guided scripts for customer calls',
    icon: Phone,
  },
  {
    title: 'Security',
    description: 'Role-based permissions and audit trails',
    icon: Shield,
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center w-full min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full py-16 md:py-24 lg:py-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex justify-center mb-8">
            <Image 
              src="/logo.svg" 
              alt="KPI Quest Logo" 
              width={180} 
              height={180} 
              className="w-36 h-36 md:w-44 md:h-44"
              priority
              unoptimized
            />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl mb-6">
            Gamify Your Team&apos;s <span className="text-primary">Performance</span>
          </h1>
          
          <p className="mx-auto max-w-[700px] text-lg text-muted-foreground mb-10">
            Transform KPI tracking into friendly competition. Track metrics, compete with colleagues, 
            and celebrate wins together.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/login" passHref>
              <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section className="w-full py-12 md:py-16 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-10">
            Everything You Need to Succeed
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mainFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.id} className="glass-card hover:scale-[1.02] transition-transform">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg ${feature.bgColor}`}>
                        <Icon className={`h-5 w-5 ${feature.color}`} />
                      </div>
                      <span className="text-xs text-muted-foreground">{feature.stats}</span>
                    </div>
                    <CardTitle className="text-lg mt-3">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Useful Tools Section */}
      <section className="w-full py-12 md:py-16 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Wrench className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight text-center">
              Useful Tools
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {toolFeatures.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.id} className="glass hover:bg-card/80 transition-colors">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                      <Icon className={`h-4 w-4 ${tool.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tool.title}</p>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="w-full py-12 md:py-16 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-8">
            Built for Teams
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex flex-col items-center text-center p-4">
                  <div className="p-3 rounded-full bg-primary/10 mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-16 md:py-20 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Ready to Boost Performance?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join your team on KPI Quest and start turning targets into achievements.
          </p>
          <Link href="/login" passHref>
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              Login / Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-6 border-t border-border text-center text-sm text-muted-foreground">
        <p>KPI Quest - Performance Management Platform</p>
      </footer>
    </div>
  );
}
