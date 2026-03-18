
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

const getMedalColor = (rank: number) => {
    switch (rank) {
        case 1: return 'text-yellow-400';
        case 2: return 'text-gray-300';
        case 3: return 'text-orange-400';
        default: return 'text-muted-foreground';
    }
};

const MockLeaderboardEntry = ({ rank, name, score, initials, bgColor }: { rank: number, name: string, score: number, initials: string, bgColor?: string }) => (
    <div className="flex items-center justify-between py-1 px-2 text-xs">
        <div className="flex items-center gap-2">
            <span className={cn("font-mono w-4 text-center", rank <= 3 ? 'font-bold' : 'text-muted-foreground')}>
               {rank <= 3 ? <Medal className={cn("inline-block h-3 w-3", getMedalColor(rank))} /> : rank}
            </span>
            <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]" initials={initials} backgroundColor={bgColor} />
            </Avatar>
            <span className="font-medium truncate">{name}</span>
        </div>
        <span className="font-semibold text-primary/90">{score.toLocaleString()} pts</span>
    </div>
);


export function MockupLeaderboardSnippet() {
  return (
     // Apply frosted-glass here
    <Card className="w-full shadow-md frosted-glass overflow-hidden">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium">Team Rankings</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-1">
        <MockLeaderboardEntry rank={1} name="Team Eagles" score={1250} initials="TE" bgColor="#4682B4" />
        <MockLeaderboardEntry rank={2} name="Team Lions" score={1080} initials="TL" bgColor="#32CD32"/>
        <MockLeaderboardEntry rank={3} name="Team Sharks" score={950} initials="TS" bgColor="#FF6347" />
        <MockLeaderboardEntry rank={4} name="Team Bears" score={820} initials="TB" bgColor="#8A2BE2" />
        <MockLeaderboardEntry rank={5} name="Team Wolves" score={790} initials="TW" bgColor="#A52A2A" />
        <MockLeaderboardEntry rank={6} name="Team Hawks" score={650} initials="TH" bgColor="#DEB887" />
        {/* Added 7th place */}
        <MockLeaderboardEntry rank={7} name="Team Pandas" score={580} initials="TP" bgColor="#696969" />
        {/* Removed 8th place */}
      </CardContent>
    </Card>
  );
}
