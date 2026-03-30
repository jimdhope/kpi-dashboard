'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Target, TrendingUp, Users, BookOpen, Contact, Zap, CheckCircle, Star, BarChart3, Award, Gamepad2 } from 'lucide-react';

const features = [
  {
    id: 'competitions',
    title: 'Competitions',
    badge: 'Current',
    badgeColor: 'bg-green-500/20 text-green-600 border-green-500/30',
    icon: Trophy,
    iconColor: 'text-yellow-500',
    features: [
      'Custom KPI competitions with flexible rules',
      'Team & individual leaderboards',
      'Daily achievement logging',
      'Team bonus points',
      'Certificate generation for top performers',
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    badge: 'Current',
    badgeColor: 'bg-green-500/20 text-green-600 border-green-500/30',
    icon: BarChart3,
    iconColor: 'text-blue-500',
    features: [
      'Campaign-wide KPI tracking',
      'Real-time dashboards',
      'Pod & agent breakdowns',
      '6-week performance trends',
      'Export-ready reports',
    ],
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    badge: 'Coming Soon',
    badgeColor: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
    icon: BookOpen,
    iconColor: 'text-purple-500',
    features: [
      'Articles & resources',
      'Help documentation',
      'Onboarding guides',
      'Team knowledge sharing',
      'Searchable wiki',
    ],
  },
  {
    id: 'directory',
    title: 'Directory',
    badge: 'Coming Soon',
    badgeColor: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
    icon: Contact,
    iconColor: 'text-orange-500',
    features: [
      'Internal contacts',
      'External contacts',
      'Quick access for agents',
      'Role-based visibility',
      'Contact search',
    ],
  },
];

const steps = [
  {
    number: 1,
    title: 'Define',
    description: 'Set up your KPIs, create competitions, and define achievement rules',
    icon: Target,
  },
  {
    number: 2,
    title: 'Track',
    description: 'Log daily achievements and monitor real-time progress',
    icon: TrendingUp,
  },
  {
    number: 3,
    title: 'Win!',
    description: 'Climb leaderboards, earn certificates, and celebrate success',
    icon: Trophy,
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="relative w-full py-20 md:py-32 lg:py-40 text-center overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-primary drop-shadow-lg">
            Gamify Your Team&apos;s Performance
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Transform KPI tracking into friendly competition. Track metrics, compete with colleagues, and celebrate wins together.
          </p>
          <div className="mt-8">
            <Link href="/login" passHref>
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-16 md:py-24 lg:py-32 frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
            Everything You Need to Succeed
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.id} variant="glass" className="relative overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-primary/10`}>
                          <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                        </div>
                        <CardTitle className="text-xl">{feature.title}</CardTitle>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full border ${feature.badgeColor}`}>
                        {feature.badge}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.features.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 bg-primary/5 flex items-center justify-center">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm max-w-[250px]">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Key Highlights */}
      <section className="w-full py-16 md:py-24 lg:py-32 frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
            Built for Teams
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50">
              <Trophy className="h-10 w-10 text-yellow-500 mb-4" />
              <h3 className="font-semibold mb-2">Leaderboards</h3>
              <p className="text-sm text-muted-foreground">Real-time rankings for pods, teams, and individuals</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50">
              <Star className="h-10 w-10 text-purple-500 mb-4" />
              <h3 className="font-semibold mb-2">Achievements</h3>
              <p className="text-sm text-muted-foreground">Log daily wins and earn points for your team</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50">
              <Award className="h-10 w-10 text-emerald-500 mb-4" />
              <h3 className="font-semibold mb-2">Certificates</h3>
              <p className="text-sm text-muted-foreground">Download awards for top performers</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50">
              <Gamepad2 className="h-10 w-10 text-blue-500 mb-4" />
              <h3 className="font-semibold mb-2">Mini-Games</h3>
              <p className="text-sm text-muted-foreground">Fun breaks that contribute to team scores</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-20 md:py-32 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Boost Performance?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Join your team on KPI Quest and start turning targets into achievements.
          </p>
          <Link href="/login" passHref>
            <Button size="lg">
              Login / Get Started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
