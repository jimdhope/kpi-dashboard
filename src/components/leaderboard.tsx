
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Medal } from 'lucide-react'; // Import Medal icon
import { generateInitials } from "@/lib/utils"; // Import generateInitials

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
    case 1: return 'text-yellow-500'; // Gold
    case 2: return 'text-gray-400'; // Silver
    case 3: return 'text-orange-600'; // Bronze
    default: return 'text-muted-foreground';
  }
}

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
              <TableRow key={entry.rank} className={entry.isUser ? 'bg-accent' : ''}>
                <TableCell className="font-medium text-center">
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
                         >
                            {!entry.avatarInitials && generateInitials(entry.name)}
                         </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="font-medium truncate">{entry.name}</span>
                     {entry.isUser && <Badge variant="outline">You</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-primary">{entry.score.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
