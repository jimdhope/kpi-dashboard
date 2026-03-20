
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Users, ListChecks, Target, User, Settings, BarChart, Zap, Plus, Minus } from 'lucide-react';
import { MockupLeaderboardSnippet } from '@/components/landing-mockup-leaderboard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { generateInitials } from '@/lib/utils';

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

// Mock Profile Snippet
const MockProfileSnippet = () => (
  <Card className="frosted-glass shadow-md p-4">
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarFallback className="bg-blue-500 text-white">JD</AvatarFallback>
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
      <section className="w-full py-12 md:py-16 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary drop-shadow-lg">
            Agent Dashboard Guide
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Welcome! Here's how to make the most of your KPI Quest Agent Dashboard.
          </p>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="w-full py-8 md:py-12 lg:py-16">
        <div className="container mx-auto px-4 md:px-6 space-y-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl mb-4">Getting Started</h2>
            <p className="text-muted-foreground md:text-lg max-w-3xl mx-auto">
              Your dashboard is designed to help you track your performance, see how your pod is doing, and stay motivated!
            </p>
          </div>

          {/* Section 1: Dashboard Overview */}
           <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="flex justify-center items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                <MockYourScoresCard />
                <MockPodTargetsCard />
                <div className="sm:col-span-2">
                  <MockupLeaderboardSnippet />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2"><BarChart className="h-6 w-6 text-primary" /> Understanding Your Dashboard</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Your Scores:</strong> Shows your total points for today and for the entire current competition, broken down by achievement.</li>
                <li><strong>Pod Targets Today:</strong> Tracks your pod's collective progress towards its daily goals for each KPI.</li>
                <li><strong>Leaderboards:</strong> See how you and your team rank against others in the current competition.</li>
              </ul>
            </div>
          </div>
          <hr className="border-border/50"/>

          {/* Section 2: Profile */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2"><User className="h-6 w-6 text-primary" /> Managing Your Profile</h3>
              <p className="text-muted-foreground">
                Go to your profile to update your display name and security settings.
                Here you can update your name and see your current pod assignment.
              </p>
            </div>
            <div className="order-1 md:order-2 flex justify-center">
                <MockProfileSnippet />
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
