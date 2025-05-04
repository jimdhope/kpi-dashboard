
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Medal } from 'lucide-react'; // Import Medal icon
import { generateInitials } from "@/lib/utils"; // Import generateInitials
import { cn } from "@/lib/utils"; // Import cn for conditional classes

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  avatarUrl?: string;
  avatarInitials?: string; // Optional custom initials
  avatarBgColor?: string; // Optional custom background color
  isUser?: boolean; // Flag to highlight the current user/team
}

interface LeaderboardProps {
  title: string;
  description?: string;
  entries: LeaderboardEntry[];
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

export function Leaderboard({ title, description, entries }: LeaderboardProps) {
  // Sort entries by score descending, then assign ranks
  const sortedEntries = [...entries]
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.map((entry) => (
              <TableRow
                key={entry.rank}
                // Apply highlight style for top 3, override default hover background for these rows
                style={getRankHighlightStyle(entry.rank)}
                // Keep user highlight, but ensure rank highlight takes precedence visually if needed
                className={cn(
                    entry.isUser && entry.rank > 3 ? 'bg-accent' : '', // Apply user highlight only if not top 3
                    entry.rank <= 3 ? 'hover:brightness-110' : 'hover:bg-muted/50' // Adjust hover for highlighted rows
                )}
              >
                <TableCell className="font-medium text-center align-middle"> {/* Ensure vertical alignment */}
                  {entry.rank <= 3 ? (
                    <Medal className={`inline-block h-5 w-5 ${getMedalColor(entry.rank)}`} />
                  ) : (
                    entry.rank
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {entry.avatarUrl ? (
                        <AvatarImage src={entry.avatarUrl} alt={entry.name} data-ai-hint="avatar person" />
                      ) : (
                         <AvatarFallback
                            initials={entry.avatarInitials || generateInitials(entry.name)}
                            backgroundColor={entry.avatarBgColor}
                             // Ensure fallback text is readable on rank background
                            className={cn(entry.rank <= 3 ? 'text-gray-800' : '')}
                         >
                            {!entry.avatarInitials && generateInitials(entry.name)}
                         </AvatarFallback>
                      )}
                    </Avatar>
                    {/* Ensure name text color contrasts with rank background */}
                    <span className={cn("font-medium truncate", entry.rank <= 3 ? 'text-white' : '')}>{entry.name}</span>
                     {/* Adjust badge style for contrast if needed */}
                     {entry.isUser && <Badge variant={entry.rank <= 3 ? "secondary" : "outline"} className={entry.rank <= 3 ? "border-white/50 text-white/90" : ""}>You</Badge>}
                  </div>
                </TableCell>
                 {/* Ensure score text color contrasts with rank background */}
                <TableCell className={cn(
                    "text-right font-semibold",
                    entry.rank <= 3 ? 'text-white' : 'text-primary'
                  )}
                >
                    {entry.score.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
