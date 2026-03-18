'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, KeyRound, User, Swords, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AgentOnboardingGuidePage() {
  const steps = [
    {
      icon: <LogIn className="h-8 w-8 text-primary" />,
      title: "Step 1: First-Time Login",
      description: "It's time to get you into the game! Your login details are simple:",
      details: [
        { label: "Email", value: "Your work email address" },
        { label: "Default Password", value: "Sigma25$$" },
      ],
      cta: <Button asChild className="w-full mt-4"><Link href="/login">Login Now <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
    },
    {
      icon: <KeyRound className="h-8 w-8 text-primary" />,
      title: "Step 2: Secure Your Account",
      description: "For your security, you should change your password immediately after your first login.",
      details: [
        { label: "Navigate", value: "Click the Settings icon in the sidebar to go to your Profile." },
        { label: "Update", value: "Enter the default password and your new, secure password." },
      ],
    },
    {
      icon: <User className="h-8 w-8 text-primary" />,
      title: "Step 3: Re-login",
      description: "To ensure your new password is active, please log out and then log back in with your new credentials.",
      details: [
         { label: "Log Out", value: "Click the 'Logout' button in the top-right header." },
         { label: "Log In Again", value: "Use your email and your new password to sign back in." },
      ],
    },
    {
      icon: <Swords className="h-8 w-8 text-primary" />,
      title: "Step 4: Play to Win!",
      description: "Now you're ready to earn bonus points for your team by playing Rock, Paper, Scissors.",
      details: [
        { label: "Find the Game", value: "Click on 'RPS Game' in the sidebar." },
        { label: "Play", value: "Make your throw and see how you stack up against the app!" },
      ],
    },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-28 text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-primary drop-shadow-lg">
            Get in the Game, Agent!
          </h1>
          <p className="mx-auto max-w-[700px] text-foreground/90 md:text-xl mt-4 drop-shadow-sm">
            Follow these simple steps to log in, secure your account, and start earning points for your team.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="w-full py-12 md:py-16 lg:py-20 frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <Card key={index} className="flex flex-col text-center items-center shadow-lg">
                <CardHeader>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    {step.icon}
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow w-full">
                  <ul className="space-y-3 text-left text-sm">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start">
                        <span className="font-semibold w-24 flex-shrink-0">{detail.label}:</span>
                        <span className="text-muted-foreground flex-1">{detail.value}</span>
                      </li>
                    ))}
                  </ul>
                  {step.cta && <div className="pt-4">{step.cta}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full py-16 md:py-24 text-center frosted-glass">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Your Quest Awaits
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl mt-4 mb-8">
            Let the games begin! Click the button below to head to the login page.
          </p>
           <Link href="/login" passHref>
             <Button size="lg" variant="default">
               Go to Login
             </Button>
            </Link>
        </div>
      </section>
    </div>
  );
}