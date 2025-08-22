
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckSquare, Trophy, Users, ListChecks, Target, MessageSquare, User, Settings, BarChart, Zap, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { MockupProgressTracking } from '@/components/landing-mockup-progress';
import { MockupLeaderboardSnippet } from '@/components/landing-mockup-leaderboard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

// Mock Card for "Your Scores"
const MockYourScoresCard = () => (
  <Card className="frosted-glass shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-base font-medium">Your Scores</CardTitle>
      <ListChecks className="h-5 w-5 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-primary">125 pts</div>
      <p className="text-xs text-muted-foreground">Competition Total</p>
      <div className="mt-3 text-sm">
        <div className="flex justify-between"><span>📞 Sales Calls</span><span>60 pts</span></div>
        <div className="flex justify-between"><span>🤝 Deals Closed</span><span>50 pts</span></div>
        <div className="flex justify-between"><span>😊 RATOC</span><span>15 pts</span></div>
      </div>
    </CardContent>
  </Card>
);

// Mock Card for "Pod Targets Today"
const MockPodTargetsCard = () => (
  <Card className="frosted-glass shadow-md">
    <CardHeader>
      <CardTitle className="text-base font-medium flex items-center gap-2"><Target className="h-5 w-5 text-primary"/> Pod Targets Today</CardTitle>
      <CardDescription className="text-xs">Your pod's progress towards daily goals.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-medium truncate">📞 Sales Calls</span>
          <span className="font-semibold text-green-600">80 / 100</span>
        </div>
        <Progress value={80} className="h-2" />
      </div>
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-medium truncate">🤝 Deals Closed</span>
          <span className="font-semibold text-orange-500">3 / 5</span>
        </div>
        <Progress value={60} className="h-2" />
      </div>
    </CardContent>
  </Card>
);

// Mock Card for Message of the Day
const MockMessageOfTheDay = () => (
  <Card className="frosted-glass shadow-md">
    <CardHeader className="flex flex-row items-center space-y-0 pb-2">
       <MessageSquare className="h-6 w-6 text-primary mr-3"/>
      <CardTitle className="text-base font-medium">Message of the Day</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm">🚀 Let's crush those targets today team! Remember, every call counts! 🚀</p>
    </CardContent>
  </Card>
);

// Mock Profile Snippet
const MockProfileSnippet = () => (
  <Card className="frosted-glass shadow-md p-4">
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarFallback initials="JD" backgroundColor="#3B82F6" />
      </Avatar>
      <div>
        <p className="text-lg font-semibold">Jane Doe</p>
        <p className="text-sm text-muted-foreground">jane.doe@example.com</p>
      </div>
      <Button variant="outline" size="sm" className="ml-auto"><Settings className="mr-2 h-4 w-4" />Edit</Button>
    </div>
  </Card>
);


export default function AgentGuidePage() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-28 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary drop-shadow-lg">
            Agent Dashboard Guide
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Welcome! Here's how to make the most of your KPI Quest Agent Dashboard.
          </p>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="w-full py-12 md:py-16 lg:py-20 frosted-glass">
        <div className="container mx-auto px-4 md:px-6 space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-4">Getting Started</h2>
            <p className="text-muted-foreground md:text-lg max-w-3xl mx-auto">
              Your dashboard is designed to help you track your performance, see how your pod is doing, and stay motivated!
            </p>
          </div>

          {/* Section 1: Logging Achievements */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 space-y-4">
              <h3 className="text-2xl font-semibold flex items-center gap-2"><CheckSquare className="h-6 w-6 text-primary" /> Log Your Daily Achievements</h3>
              <p className="text-muted-foreground">
                The "Today's Achievements" section is where you'll log your progress for each KPI.
                Use the <Button size="sm" variant="ghost" className="p-1 h-auto inline-block"><Plus className="h-4 w-4"/></Button> button to increment your count for a specific achievement, and the <Button size="sm" variant="ghost" className="p-1 h-auto inline-block"><Minus className="h-4 w-4"/></Button> button to decrease it.
                Your scores are saved automatically as you make changes!
              </p>
            </div>
            <div className="order-1 md:order-2 flex justify-center">
              <div className="w-full max-w-md">
                 <MockupProgressTracking />
              </div>
            </div>
          </div>
          <hr className="border-border/50"/>

          {/* Section 2: Dashboard Overview */}
           <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                <MockMessageOfTheDay/>
                <MockYourScoresCard />
                <MockPodTargetsCard />
                <MockupLeaderboardSnippet />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold flex items-center gap-2"><BarChart className="h-6 w-6 text-primary" /> Understanding Your Dashboard</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Message of the Day:</strong> Important updates or motivational messages from your admin/manager.</li>
                <li><strong>Your Scores:</strong> Shows your total points for today and for the entire current competition, broken down by achievement.</li>
                <li><strong>Pod Targets Today:</strong> Tracks your pod's collective progress towards its daily goals for each KPI.</li>
                <li><strong>Leaderboards:</strong> See how you and your team rank against others in the current competition.</li>
              </ul>
            </div>
          </div>
          <hr className="border-border/50"/>

          {/* Section 3: Profile */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 space-y-4">
              <h3 className="text-2xl font-semibold flex items-center gap-2"><User className="h-6 w-6 text-primary" /> Managing Your Profile</h3>
              <p className="text-muted-foreground">
                Click the <Button variant="ghost" size="icon" className="inline-flex align-middle h-7 w-7"><Settings className="h-4 w-4"/></Button> icon at the bottom of the sidebar to go to your profile.
                Here you can update your name and customize your avatar's initials and background color.
              </p>
            </div>
            <div className="order-1 md:order-2 flex justify-center">
                <MockProfileSnippet />
            </div>
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-16 md:py-24 text-center frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Conquer Your KPIs?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Log in to your dashboard and start your quest!
          </p>
           <Link href="/agent" passHref>
             <Button size="lg" variant="default">
               Go to My Dashboard
             </Button>
            </Link>
        </div>
      </section>
    </div>
  );
}
    
