'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Trophy, Users, BarChart, Zap, Target } from 'lucide-react'; // Added Zap, Target
import Link from 'next/link';
import { Progress } from '@/components/ui/progress'; // Import Progress
import { Avatar, AvatarFallback } from '@/components/ui/avatar'; // Import Avatar


// Mock Leaderboard Entry Component
const MockLeaderboardEntry = ({ rank, name, score, initials, bgColor }: { rank: number, name: string, score: number, initials: string, bgColor?: string }) => (
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
  <Card className="text-left shadow-md frosted-glass"> {/* Apply frosted glass */}
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
    // Use min-h-screen on the outer div if needed, but PublicLayout likely handles it.
    // items-center centers horizontally. The container handles width.
    <div className="flex flex-col items-center w-full">
      {/* Hero Section - Already centered */}
      <section className="w-full py-20 md:py-32 lg:py-40 bg-gradient-to-b from-primary/10 via-background to-background text-center">
        <div className="container px-4 md:px-6">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-primary animate-fade-in">
            Welcome to KpiQuest
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/80 md:text-xl mt-4 animate-fade-in animation-delay-200">
            Gamify your team's performance, track KPIs effortlessly, and foster friendly competition to drive results.
          </p>
          <div className="mt-8 animate-fade-in animation-delay-400">
            <Link href="/login" passHref>
             <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </section>

       {/* Features & Preview Section */}
       <section id="features" className="w-full py-16 md:py-24 lg:py-32">
         <div className="container px-4 md:px-6">
           <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-16">
             How KpiQuest Elevates Performance
           </h2>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Feature Text */}
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

              {/* Mockup Section */}
              <div className="space-y-6 animate-fade-in-up"> {/* Added fade-in-up animation */}
                  {/* Mock KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <MockKpiCard title="Sales Calls" value="85" target="120" progress={71} icon={<Target />} />
                       <MockKpiCard title="Customer Rating" value="4.8" target="4.5" progress={100} icon={<CheckCircle />} />
                  </div>

                  {/* Mock Leaderboard Snippet */}
                  <Card className="frosted-glass"> {/* Apply frosted glass */}
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

       {/* How it Works (Simplified) - Already centered */}
       <section className="w-full py-16 md:py-24 lg:py-32 bg-muted/40">
        <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
              Simple Steps to Success
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
               <div className="flex flex-col items-center text-center animate-fade-in-up">
                 <div className="mb-4 rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center">1</div>
                 <h3 className="text-xl font-semibold mb-2">Define KPIs</h3>
                 <p className="text-muted-foreground">Set clear, measurable goals for your campaigns and pods.</p>
               </div>
               <div className="flex flex-col items-center text-center animate-fade-in-up animation-delay-200">
                 <div className="mb-4 rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center">2</div>
                 <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
                 <p className="text-muted-foreground">Log daily achievements and monitor performance via dashboards.</p>
               </div>
                <div className="flex flex-col items-center text-center animate-fade-in-up animation-delay-400">
                 <div className="mb-4 rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center">3</div>
                 <h3 className="text-xl font-semibold mb-2">Celebrate Wins</h3>
                 <p className="text-muted-foreground">Recognize top performers and motivate with leaderboards.</p>
               </div>
            </div>
          </div>
       </section>

      {/* CTA Section - Already centered */}
      <section className="w-full py-20 md:py-32 text-center">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Boost Performance?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Log in to start your KpiQuest adventure today.
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

// Add simple animation definitions if not already present in globals.css
// or tailwind.config.js (tailwindcss-animate might provide these)
// Example (add to globals.css if needed):
/*
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fade-in 0.6s ease-out forwards;
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}

.animation-delay-200 { animation-delay: 0.2s; }
.animation-delay-400 { animation-delay: 0.4s; }
*/

// Ensure tailwind.config.js includes these animations if using utility classes
// Example for tailwind.config.js extend section:
/*
extend: {
  animation: {
    'fade-in': 'fade-in 0.6s ease-out forwards',
    'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
  },
  keyframes: {
    'fade-in': {
      'from': { opacity: '0' },
      'to': { opacity: '1' },
    },
    'fade-in-up': {
      'from': { opacity: '0', transform: 'translateY(20px)' },
      'to': { opacity: '1', transform: 'translateY(0)' },
    }
  },
}
*/