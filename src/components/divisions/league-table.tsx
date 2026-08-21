'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { divisionLabel, divisionBadgeClass, type LeagueTableData } from '@/lib/divisions';

const MEDALS = ['🥇', '🥈', '🥉'];

function FormChips({ form }: { form: number[] }) {
  if (form.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {form.map((position, index) => (
        <span
          key={index}
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
            position === 1 && 'bg-emerald-500/20 text-emerald-600',
            position === 2 && 'bg-blue-500/20 text-blue-600',
            position === 3 && 'bg-amber-500/20 text-amber-600',
            position > 3 && 'bg-muted text-muted-foreground',
          )}
        >
          {position}
        </span>
      ))}
    </div>
  );
}

export function DivisionLeagueTable({
  table,
  currentUserId,
}: {
  table: LeagueTableData;
  currentUserId?: string;
}) {
  const zoneFor = (index: number): 'promotion' | 'relegation' | null => {
    if (table.promotionSlots > 0 && index < table.promotionSlots) return 'promotion';
    if (table.relegationSlots > 0 && index >= table.rows.length - table.relegationSlots) {
      return 'relegation';
    }
    return null;
  };

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{divisionLabel(table.division)}</span>
          <Badge variant="outline" className={cn('text-[10px]', divisionBadgeClass(table.division))}>
            {divisionLabel(table.division)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Pos</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-14 text-center">Pld</TableHead>
                <TableHead className="w-16 text-right">Pts</TableHead>
                <TableHead className="w-32">Form</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-xs">
                    No players in this division yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.rows.map((row, index) => {
                  const zone = zoneFor(index);
                  const isCurrentUser = row.userId === currentUserId;
                  return (
                    <TableRow
                      key={row.userId}
                      className={cn(
                        zone === 'promotion' && 'bg-emerald-500/10',
                        zone === 'relegation' && 'bg-red-500/10',
                        isCurrentUser && 'ring-1 ring-primary/40 bg-primary/5',
                      )}
                    >
                      <TableCell className="text-center font-bold tabular-nums">
                        {index < 3 ? MEDALS[index] : row.rank}
                      </TableCell>
                      <TableCell className={cn('font-medium', isCurrentUser && 'text-primary font-semibold')}>
                        {isCurrentUser ? 'You' : row.userName ?? 'Unknown'}
                        {zone === 'promotion' && (
                          <span className="ml-2 text-[9px] uppercase tracking-wide text-emerald-600">▲ promotion</span>
                        )}
                        {zone === 'relegation' && (
                          <span className="ml-2 text-[9px] uppercase tracking-wide text-red-600">▼ relegation</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{row.played}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {row.points.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <FormChips form={row.form} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden divide-y">
          {table.rows.map((row, index) => {
            const zone = zoneFor(index);
            const isCurrentUser = row.userId === currentUserId;
            return (
              <div
                key={row.userId}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  zone === 'promotion' && 'bg-emerald-500/10',
                  zone === 'relegation' && 'bg-red-500/10',
                  isCurrentUser && 'bg-primary/10',
                )}
              >
                <span className="w-6 text-center text-sm font-bold tabular-nums">
                  {index < 3 ? MEDALS[index] : row.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm truncate', isCurrentUser ? 'font-semibold text-primary' : 'font-medium')}>
                    {isCurrentUser ? 'You' : row.userName ?? 'Unknown'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {row.played} played
                    {zone === 'promotion' ? ' · ▲ promotion' : zone === 'relegation' ? ' · ▼ relegation' : ''}
                  </p>
                </div>
                <FormChips form={row.form} />
                <span className="text-sm font-bold tabular-nums">{row.points.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
