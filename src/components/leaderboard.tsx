
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Medal } from 'lucide-react';
import { generateInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  id: string;
  rank?: number;
  name: string;
  score: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  emoji?: string; // Added emoji for teams
  isUser?: boolean;
}

interface LeaderboardProps {
  title: string;
  description?: string;
  entries: LeaderboardEntry[];
  isStickyHeader?: boolean;
}

const getMedalColor = (rank: number) => {
  switch (rank) {
    case 1: return 'text-yellow-400';
    case 2: return 'text-gray-300';
    case 3: return 'text-orange-400';
    default: return 'text-muted-foreground';
  }
}

const getRankHighlightStyle = (rank: number): React.CSSProperties => {
  switch (rank) {
    case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' };
    case 2: return { backgroundColor: '#969696', color: '#ffffff' };
    case 3: return { backgroundColor: '#996b4f', color: '#ffffff' };
    default: return {};
  }
};

// Mobile Card Component for individual entries
function LeaderboardCardEntry({ entry }: { entry: LeaderboardEntry & { rank: number } }) {
  const style = getRankHighlightStyle(entry.rank);
  const isTopThree = entry.rank <= 3;
  
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg transition-colors",
        isTopThree ? 'hover:brightness-105' : 'hover:bg-muted/30',
        entry.isUser && !isTopThree ? 'bg-accent/50' : ''
      )}
      style={style}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
          entry.rank === 1 && 'bg-yellow-400/30 text-yellow-400',
          entry.rank === 2 && 'bg-gray-400/30 text-gray-300',
          entry.rank === 3 && 'bg-orange-400/30 text-orange-400',
          entry.rank > 3 && 'bg-muted text-muted-foreground'
        )}>
          {entry.rank <= 3 ? (
            <Medal className={cn("h-5 w-5", getMedalColor(entry.rank))} />
          ) : (
            entry.rank
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {entry.emoji ? (
            <span className="text-xl shrink-0">{entry.emoji}</span>
          ) : (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback
                initials={entry.avatarInitials || generateInitials(entry.name)}
                backgroundColor={entry.avatarBgColor}
                className={cn(entry.rank <= 3 ? 'text-gray-900' : '')}
              >
                {!entry.avatarInitials && generateInitials(entry.name)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className={cn("font-medium truncate", isTopThree ? 'text-white' : '')}>
              {entry.name}
            </span>
            {entry.isUser && (
              <Badge 
                variant={isTopThree ? "secondary" : "outline"} 
                className={cn("text-[10px] h-4 w-fit", isTopThree ? "border-white/50 text-white/90" : "")}
              >
                You
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className={cn(
        "text-lg font-bold tabular-nums shrink-0 ml-2",
        isTopThree ? 'text-white' : 'text-primary'
      )}>
        {(entry.score ?? 0).toLocaleString()}
      </div>
    </div>
  );
}

export function Leaderboard({ title, description, entries, isStickyHeader = true }: LeaderboardProps) {
    const sortedEntries = [...entries].sort((a, b) => (b.score || 0) - (a.score || 0));

    const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
        if (items.length === 0) return [];
        const itemsWithScores = items.map(item => ({ ...item, score: typeof item.score === 'number' ? item.score : 0 }));
        const sorted = [...itemsWithScores].sort((a, b) => b.score - a.score);

        if (sorted.length === 0) return [];

        const scoreRankMap = new Map<number, number>();
        let rankCounter = 1;
        for (const item of sorted) {
            if (!scoreRankMap.has(item.score)) {
                scoreRankMap.set(item.score, rankCounter++);
            }
        }
        return items.map(item => ({
            ...item,
            score: typeof item.score === 'number' ? item.score : 0,
            rank: scoreRankMap.get(typeof item.score === 'number' ? item.score : 0) || items.length
        }));
    };

    const rankedEntries = assignDenseRanks(sortedEntries);

  return (
    <Card className="shadow-md frosted-glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn(isStickyHeader && "overflow-y-auto max-h-[calc(100vh-380px)]")}>
        {/* Desktop Table View - hidden on mobile */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className={cn(isStickyHeader && "sticky top-0 z-10 bg-background")}>
              <TableRow>
                <TableHead className="w-[50px]">Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedEntries.map((entry) => (
                <TableRow
                  key={`${entry.id}-${entry.name}`}
                  style={getRankHighlightStyle(entry.rank ?? 0)}
                  className={cn(
                      entry.isUser && (entry.rank ?? 0) > 3 ? 'bg-accent' : '',
                      (entry.rank ?? 0) <= 3 ? 'hover:brightness-110' : 'hover:bg-muted/50'
                  )}
                >
                  <TableCell className="font-medium text-center align-middle">
                    {(entry.rank ?? 0) <= 3 ? (
                      <Medal className={cn("inline-block h-5 w-5", getMedalColor(entry.rank ?? 0))} />
                    ) : (
                      entry.rank
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {entry.emoji ? (
                          <span className="text-xl">{entry.emoji}</span>
                      ) : (
                          <Avatar className="h-8 w-8">
                          <AvatarFallback
                              initials={entry.avatarInitials || generateInitials(entry.name)}
                              backgroundColor={entry.avatarBgColor}
                              className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-900' : '')}
                          >
                              {!entry.avatarInitials && generateInitials(entry.name)}
                          </AvatarFallback>
                          </Avatar>
                      )}
                      <span className={cn("font-medium truncate", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>{entry.name}</span>
                       {entry.isUser && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>You</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className={cn(
                      "text-right font-semibold",
                      (entry.rank ?? 0) <= 3 ? 'text-white' : 'text-primary'
                    )}
                  >
                      {(entry.score ?? 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View - hidden on desktop */}
        <div className="md:hidden space-y-2">
          {rankedEntries.map((entry) => (
            <LeaderboardCardEntry key={`mobile-${entry.id}-${entry.name}`} entry={entry} />
          ))}
          {rankedEntries.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No entries</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
