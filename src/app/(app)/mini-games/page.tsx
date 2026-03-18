'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Swords, Trophy, Zap } from "lucide-react";
import Link from "next/link";

export default function MiniGamesDashboard() {
  const games = [
    {
      title: "Rock Paper Scissors",
      description: "Challenge your teammates in the classic game of Rock Paper Scissors!",
      href: "/mini-games/rps",
      icon: Swords,
      color: "text-orange-500",
      bgColor: "bg-orange-500/20",
      players: "2 players",
      status: "Available",
    },
  ];

  const upcomingGames = [
    {
      title: "Trivia Challenge",
      description: "Test your knowledge with fun trivia questions",
      icon: Zap,
      comingSoon: true,
    },
    {
      title: "Speed Quiz",
      description: "Race against time in this fast-paced quiz game",
      icon: Trophy,
      comingSoon: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mini Games</h1>
          <p className="text-muted-foreground">Fun games and activities for your team</p>
        </div>
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className={`p-3 rounded-lg ${game.bgColor}`}>
                      <Icon className={`h-6 w-6 ${game.color}`} />
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-500">
                      {game.status}
                    </span>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg">{game.title}</CardTitle>
                    <CardDescription className="mt-1">{game.description}</CardDescription>
                    <p className="text-xs text-muted-foreground mt-3">{game.players}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {upcomingGames.map((game) => {
            const Icon = game.icon;
            return (
              <Card key={game.title} variant="glass" className="opacity-60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="p-3 rounded-lg bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                    Coming Soon
                  </span>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg">{game.title}</CardTitle>
                  <CardDescription className="mt-1">{game.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Games Played</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">Total games played</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Players online</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">Games won today</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
