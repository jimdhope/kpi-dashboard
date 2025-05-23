import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; // Remove AvatarImage import
import { Badge } from "@/components/ui/badge";
import { Medal } from 'lucide-react'; // Import Medal icon
import { generateInitials } from "@/lib/utils"; // Import generateInitials
import { cn } from "@/lib/utils"; // Import cn for conditional classes

interface LeaderboardEntry {
  id: string; // Added ID for React key prop
  rank?: number; // Rank might be undefined before sorting
  name: string;
  score: number; // Score should be a number
  avatarUrl?: string; // Keep URL for data storage, but don't display image
  avatarInitials?: string; // Optional custom initials
  avatarBgColor?: string; // Optional custom background color
  isUser?: boolean; // Flag to highlight the current user/team
  // Removed isCurrentUser/isCurrentUserTeam, using isUser generic flag
}

interface LeaderboardProps {
  title: string;
  description?: string;
  entries: LeaderboardEntry[];
  isStickyHeader?: boolean; // New prop to control sticky header
}

const getMedalColor = (rank: number) => {
  switch (rank) {
    case 1: return 'text-yellow-400'; // Adjusted Gold
    case 2: return 'text-gray-300'; // Adjusted Silver
    case 3: return 'text-orange-400'; // Adjusted Bronze
    default: return 'text-muted-foreground';
  }
}

// Helper function to get style for top ranks
const getRankHighlightStyle = (rank: number): React.CSSProperties => {
  switch (rank) {
    case 1: return { backgroundColor: '#9f8f5e', color: '#ffffff' }; // Gold-ish background, white text
    case 2: return { backgroundColor: '#969696', color: '#ffffff' }; // Silver-ish background, white text
    case 3: return { backgroundColor: '#996b4f', color: '#ffffff' }; // Bronze-ish background, white text
    default: return {}; // No special style for other ranks
  }
};

export function Leaderboard({ title, description, entries, isStickyHeader = true }: LeaderboardProps) {
   // Sort entries by score descending
   const sortedEntries = [...entries].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Assign ranks using dense ranking logic (1, 2, 2, 3...)
    const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
        if (items.length === 0) return [];

        const itemsWithScores = items.map(item => ({ ...item, score: typeof item.score === 'number' ? item.score : 0 }));
        const sorted = [...itemsWithScores].sort((a, b) => b.score - a.score);

        if (sorted.length === 0) return [];

        const ranked: (T & { rank: number })[] = [];
        let currentRank = 1;
        ranked.push({ ...sorted[0], rank: currentRank });

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].score < sorted[i-1].score) {
                currentRank = i + 1; // Standard competition ranking (if 2 people tie for 2nd, next is 4th)
                                     // If dense ranking (1,2,2,3) is needed, this logic changes
                                     // For now, let's assume standard ranking for simplicity or use a more robust rank assignment.
                                     // To implement dense ranking (1, 2, 2, 3):
                                     // if (sorted[i].score < sorted[i-1].score) currentRank++;
                                     // This needs to be more robust to handle multiple ties correctly for dense rank.

                // Corrected dense ranking logic:
                // If current score is less than previous, increment rank.
                // If current score is same as previous, use same rank as previous.
                // This is actually simpler: if score is different from previous, rank is i + 1
                // if score is same, rank is same as previous.
                // Let's use the simpler dense rank:
                if (sorted[i].score < sorted[i-1].score) {
                     currentRank = ranked[i-1].rank + 1;
                } else {
                    currentRank = ranked[i-1].rank;
                }

            } else {
                // If score is same, use the rank of the previous entry
                currentRank = ranked[i-1].rank;
            }
            ranked.push({ ...sorted[i], rank: currentRank });
        }
         // Final pass for true dense ranking (1,1,2,3) or (1,2,2,3)
         // This is more complex to do correctly if the previous was simplified.
         // Let's use a simpler dense rank calculation
         const scoreRankMap = new Map<number, number>();
         let rankCounter = 1;
         for (const item of sorted) { // Use the original sorted (by score) array
             if (!scoreRankMap.has(item.score)) {
                 scoreRankMap.set(item.score, rankCounter++);
             }
         }
         return items.map(item => ({
             ...item,
             score: typeof item.score === 'number' ? item.score : 0,
             rank: scoreRankMap.get(typeof item.score === 'number' ? item.score : 0) || items.length // Fallback rank
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
                key={entry.id}
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
                    <Avatar className="h-8 w-8">
                       <AvatarFallback
                          initials={entry.avatarInitials || generateInitials(entry.name)}
                          backgroundColor={entry.avatarBgColor}
                          className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-900' : '')}
                       >
                          {!entry.avatarInitials && generateInitials(entry.name)}
                       </AvatarFallback>
                    </Avatar>
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
      </CardContent>
    </Card>
  );
}
