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
            <TableRow>{/* Remove whitespace here */}
              <TableHead className="w-[50px]">Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.map((entry) => (
              <TableRow
                key={entry.id} // Use ID for key
                // Apply highlight style for top 3, override default hover background for these rows
                style={getRankHighlightStyle(entry.rank ?? 0)}
                // Keep user highlight, but ensure rank highlight takes precedence visually if needed
                className={cn(
                    entry.isUser && (entry.rank ?? 0) > 3 ? 'bg-accent' : '', // Apply user highlight only if not top 3
                    (entry.rank ?? 0) <= 3 ? 'hover:brightness-110' : 'hover:bg-muted/50' // Adjust hover for highlighted rows
                )}
              >
                <TableCell className="font-medium text-center align-middle"> {/* Ensure vertical alignment */}
                  {(entry.rank ?? 0) <= 3 ? (
                    <Medal className={cn("inline-block h-5 w-5", getMedalColor(entry.rank ?? 0))} />
                  ) : (
                    entry.rank
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                       {/* Always use Fallback */}
                       <AvatarFallback
                          initials={entry.avatarInitials || generateInitials(entry.name)}
                          backgroundColor={entry.avatarBgColor}
                           // Ensure fallback text is readable on rank background
                           // Use a very dark color for fallbacks on light rank backgrounds
                          className={cn((entry.rank ?? 0) <= 3 ? 'text-gray-900' : '')}
                       >
                          {!entry.avatarInitials && generateInitials(entry.name)}
                       </AvatarFallback>
                    </Avatar>
                    {/* Ensure name text color contrasts with rank background (explicitly white) */}
                    <span className={cn("font-medium truncate", (entry.rank ?? 0) <= 3 ? 'text-white' : '')}>{entry.name}</span>
                     {/* Adjust badge style for contrast if needed */}
                     {entry.isUser && <Badge variant={(entry.rank ?? 0) <= 3 ? "secondary" : "outline"} className={cn("ml-2", (entry.rank ?? 0) <= 3 ? "border-white/50 text-white/90" : "")}>You</Badge>}
                  </div>
                </TableCell>
                 {/* Ensure score text color contrasts with rank background (explicitly white) */}
                <TableCell className={cn(
                    "text-right font-semibold",
                    (entry.rank ?? 0) <= 3 ? 'text-white' : 'text-primary'
                  )}
                >
                    {/* Provide default value for score before calling toLocaleString */}
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
