'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Trophy, Users, BarChart, Zap, Target } from 'lucide-react'; // Added Zap, Target
import Link from 'next/link';
import { Progress } from '@/components/ui/progress'; // Import Progress
import { Avatar, AvatarFallback } from '@/components/ui/avatar'; // Import Avatar
// Removed: import AnimatedIconBackground from '@/components/animated-icon-background'; // Import the component
import { MockupKpiDefinition } from '@/components/landing-mockup-kpi'; // Import KPI Definition Mockup
import { MockupProgressTracking } from '@/components/landing-mockup-progress'; // Import Progress Tracking Mockup
import { MockupLeaderboardSnippet } from '@/components/landing-mockup-leaderboard'; // Import Leaderboard Mockup


// Mock Leaderboard Entry Component
const MockLeaderboardEntry = ({ rank, name, score, initials, bgColor }: { rank: number; name: string; score: number; initials: string; bgColor?: string }) => (
  <div className="flex items-center justify-between p-2 rounded-md transition-colors hover:bg-muted/50">
    <div className="flex items-center gap-3">
      <span className="font-mono text-sm w-4 text-center text-muted-foreground">{rank}</span>
       <Avatar className="h-7 w-7">
         <AvatarFallback initials={initials} backgroundColor={bgColor} />
       </Avatar>
      <span className="text-sm font-medium">{name}</span>
    </div>
    <span className="text-sm font-semibold text-primary">{score.toLocaleString()} pts</span>
  </div>
);

// Mock KPI Card Component
const MockKpiCard = ({ title, value, target, progress, icon }: { title: string, value: string, target: string, progress: number, icon: React.ReactNode }) => (
  // Ensure mock card itself uses frosted glass
  <Card className="text-left shadow-md frosted-glass">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
       <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-primary">{value}</div>
      <p className="text-xs text-muted-foreground">Target: {target}</p>
      <Progress value={progress} className="mt-3 h-2" />
      <p className="mt-1 text-xs text-muted-foreground">
        {progress.toFixed(0)}% achieved
      </p>
    </CardContent>
  </Card>
);


export default function LandingPage() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section - Remove frosted-glass, ensure background is transparent */}
      <section
        className="relative w-full py-20 md:py-32 lg:py-40 text-center overflow-hidden" // Removed frosted-glass
      >
        {/* Removed: <AnimatedIconBackground /> */} {/* This will be behind the content due to z-index */}
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-primary drop-shadow-lg">
            Welcome to KPI Quest
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Gamify your team's performance, track KPIs effortlessly, and foster friendly competition to drive results.
          </p>
          <div className="mt-8">
            <Link href="/login" passHref>
             <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </section>

       {/* Features & Preview Section - Apply frosted-glass */}
       <section id="features" className="w-full py-16 md:py-24 lg:py-32 frosted-glass">
         <div className="container mx-auto px-4 md:px-6">
           <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-16">
             How KPI Quest Elevates Performance
           </h2>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                 <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full p-3">
                        <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">Gamified Motivation</h3>
                        <p className="text-muted-foreground mt-1">Boost engagement with dynamic leaderboards, points for achievements, and friendly team rivalries.</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full p-3">
                        <BarChart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">Clear KPI Tracking</h3>
                        <p className="text-muted-foreground mt-1">Visualize progress towards individual and pod targets with intuitive dashboards and progress bars.</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full p-3">
                        <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">Team Collaboration</h3>
                        <p className="text-muted-foreground mt-1">Foster teamwork within pods, encourage peer support, and celebrate collective success.</p>
                    </div>
                 </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 rounded-full p-3">
                        <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">AI-Powered Encouragement</h3>
                        <p className="text-muted-foreground mt-1">Receive personalized motivational messages based on your progress to keep the momentum going.</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {/* These MockKpiCards inherently have frosted-glass applied */}
                       <MockKpiCard title="Sales Calls" value="85" target="120" progress={71} icon={<Target />} />
                       <MockKpiCard title="Customer Rating" value="4.8" target="4.5" progress={100} icon={<CheckCircle />} />
                  </div>
                  {/* This Card should also have frosted-glass */}
                  <Card className="frosted-glass">
                      <CardHeader>
                          <CardTitle className="text-lg">Pod Leaderboard</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                          <MockLeaderboardEntry rank={1} name="Alpha Pod" score={1250} initials="AP" bgColor="#008080" />
                          <MockLeaderboardEntry rank={2} name="Bravo Pod" score={1080} initials="BP" bgColor="#FFD700"/>
                          <MockLeaderboardEntry rank={3} name="Charlie Pod" score={950} initials="CP" bgColor="#FF8C00" />
                      </CardContent>
                  </Card>
              </div>
           </div>
         </div>
       </section>

       {/* How it Works - Remove frosted-glass from section, ensure cards inside keep it */}
       <section className="w-full py-16 md:py-24 lg:py-32"> {/* Removed frosted-glass */}
        <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
              Simple Steps to Success
            </h2>
             <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                 <div className="mb-4 mx-auto rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center flex-shrink-0">1</div>
                 {/* Ensure Mockup component has frosted-glass */}
                 <div className="mb-6 w-full max-w-xs mx-auto min-h-[280px] flex items-center justify-center flex-shrink-0">
                    <MockupKpiDefinition />
                 </div>
                 <h3 className="text-xl font-semibold mb-2">Define KPIs</h3>
                 <p className="text-muted-foreground mb-4 min-h-[60px]">Set clear, measurable goals for your campaigns and pods.</p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                 <div className="mb-4 mx-auto rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center flex-shrink-0">2</div>
                  {/* Ensure Mockup component has frosted-glass */}
                 <div className="mb-6 w-full max-w-xs mx-auto min-h-[280px] flex items-center justify-center flex-shrink-0">
                    <MockupProgressTracking />
                 </div>
                 <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
                 <p className="text-muted-foreground mb-4 min-h-[60px]">Log daily achievements and monitor performance via dashboards.</p>
              </div>

               {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                 <div className="mb-4 mx-auto rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center flex-shrink-0">3</div>
                  {/* Ensure Mockup component has frosted-glass */}
                 <div className="mb-6 w-full max-w-xs mx-auto min-h-[280px] flex items-center justify-center flex-shrink-0">
                    <MockupLeaderboardSnippet />
                 </div>
                 <h3 className="text-xl font-semibold mb-2">Celebrate Wins</h3>
                 <p className="text-muted-foreground mb-4 min-h-[60px]">Recognize top performers and motivate with leaderboards.</p>
              </div>
            </div>
          </div>
       </section>

      {/* CTA Section - Apply frosted-glass */}
      <section className="w-full py-20 md:py-32 text-center frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Boost Performance?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Log in to start your KPI Quest adventure today.
          </p>
           <Link href="/login" passHref>
             <Button size="lg" variant="default">
               Login / Get Started
             </Button>
            </Link>
        </div>
      </section>
    </div>
  );
}
