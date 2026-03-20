'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Swords } from "lucide-react";
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AgentMiniGamesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const games = [
    {
      title: "Rock Paper Scissors",
      description: "Challenge your teammates in the classic game of Rock Paper Scissors!",
      href: "/mini-games/rps",
      icon: Swords,
      color: "text-orange-500",
      bgColor: "bg-orange-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mini Games</h1>
        <p className="text-muted-foreground">Play games and compete!</p>
      </div>

      {/* Available Games */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Games</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <Link key={game.href} href={game.href}>
                <Card variant="glass" className="glass-card-hover h-full cursor-pointer">
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className={`p-3 rounded-lg ${game.bgColor}`}>
                      <Icon className={`h-6 w-6 ${game.color}`} />
                    </div>
                    <CardTitle className="text-lg">{game.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{game.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
