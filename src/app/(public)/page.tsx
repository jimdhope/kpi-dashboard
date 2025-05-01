'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Trophy, Users, BarChart } from 'lucide-react';
import Link from 'next/link';


export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 lg:py-40 bg-gradient-to-b from-primary/10 via-background to-background text-center">
        <div className="container px-4 md:px-6">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-primary">
            Welcome to KpiQuest
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/80 md:text-xl mt-4">
            Gamify your team's performance, track KPIs effortlessly, and foster friendly competition to drive results.
          </p>
          <div className="mt-8">
            <Link href="/login" passHref>
             <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </section>

       {/* Features Section */}
       <section id="features" className="w-full py-16 md:py-24 lg:py-32">
         <div className="container px-4 md:px-6">
           <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
             Why Choose KpiQuest?
           </h2>
           <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
             <Card className="text-center shadow-md hover:shadow-lg transition-shadow">
               <CardHeader>
                 <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-4">
                   <Trophy className="h-8 w-8 text-primary" />
                 </div>
                 <CardTitle>Gamified Motivation</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-muted-foreground">Boost engagement with leaderboards, achievements, and points.</p>
               </CardContent>
             </Card>
             <Card className="text-center shadow-md hover:shadow-lg transition-shadow">
               <CardHeader>
                  <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-4">
                   <BarChart className="h-8 w-8 text-primary" />
                 </div>
                 <CardTitle>Clear KPI Tracking</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-muted-foreground">Visualize progress towards targets with intuitive dashboards.</p>
               </CardContent>
             </Card>
              <Card className="text-center shadow-md hover:shadow-lg transition-shadow">
               <CardHeader>
                 <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-4">
                   <Users className="h-8 w-8 text-primary" />
                 </div>
                 <CardTitle>Team Collaboration</CardTitle>
               </CardHeader>
               <CardContent>
                 <p className="text-muted-foreground">Foster teamwork and friendly competition within pods and teams.</p>
               </CardContent>
             </Card>
           </div>
         </div>
       </section>

       {/* How it Works (Optional) */}
       <section className="w-full py-16 md:py-24 lg:py-32 bg-muted/40">
        <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl mb-12">
              Simple Steps to Success
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
               <div className="flex flex-col items-center text-center">
                 <div className="mb-4 rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center">1</div>
                 <h3 className="text-xl font-semibold mb-2">Define KPIs</h3>
                 <p className="text-muted-foreground">Set clear, measurable goals for your teams or individuals.</p>
               </div>
               <div className="flex flex-col items-center text-center">
                 <div className="mb-4 rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center">2</div>
                 <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
                 <p className="text-muted-foreground">Agents update achievements, managers monitor dashboards.</p>
               </div>
                <div className="flex flex-col items-center text-center">
                 <div className="mb-4 rounded-full border-4 border-primary p-3 text-primary font-bold text-xl w-12 h-12 flex items-center justify-center">3</div>
                 <h3 className="text-xl font-semibold mb-2">Celebrate Wins</h3>
                 <p className="text-muted-foreground">Recognize top performers and motivate everyone with gamification.</p>
               </div>
            </div>
          </div>
       </section>

      {/* CTA Section */}
      <section className="w-full py-20 md:py-32 text-center">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Ready to Boost Performance?
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Sign up or log in to start your KpiQuest adventure today.
          </p>
           <Link href="/login" passHref>
             <Button size="lg" variant="default">
               Login / Sign Up
             </Button>
            </Link>
        </div>
      </section>
    </div>
  );
}
