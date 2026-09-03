'use client';

import React from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Trophy, Users, User, Hash, Calendar, Award, Star, MessageSquare, Type
} from 'lucide-react';

interface TokenToolbarProps {
  editor: Editor;
}

const TOKENS = [
  { key: 'competitionName', label: 'Competition Name', icon: Trophy },
  { key: 'competitionDescription', label: 'Competition Description', icon: Type },
  { key: 'competitionDuration', label: 'Competition Duration', icon: Calendar },
  { key: 'totalCompetitors', label: 'Total Competitors', icon: Hash },
  { key: 'winningTeamName', label: 'Winning Team Name', icon: Users },
  { key: 'winningTeamMembers', label: 'Winning Team Members', icon: Users },
  { key: 'winningTeamScore', label: 'Winning Team Score', icon: Award },
  { key: 'topPerformer1Name', label: '1st Place Name', icon: Star },
  { key: 'topPerformer1Score', label: '1st Place Score', icon: Award },
  { key: 'topPerformer2Name', label: '2nd Place Name', icon: Star },
  { key: 'topPerformer2Score', label: '2nd Place Score', icon: Award },
  { key: 'topPerformer3Name', label: '3rd Place Name', icon: Star },
  { key: 'topPerformer3Score', label: '3rd Place Score', icon: Award },
  { key: 'nextWeekCompetitionName', label: 'Next Week Competition', icon: Calendar },
  { key: 'nextWeekTheme', label: 'Next Week Theme', icon: MessageSquare },
  { key: 'postType', label: 'Post Type', icon: MessageSquare },
];

export function TokenToolbar({ editor }: TokenToolbarProps) {
  const insertToken = (tokenKey: string) => {
    editor.chain().focus().insertContent(`{${tokenKey}}`).run();
  };

  return (
    <div className="border-b p-2 flex flex-wrap gap-1 items-center bg-muted/30">
      <span className="text-xs text-muted-foreground mr-2">Insert:</span>
      {TOKENS.map(({ key, label, icon: Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => insertToken(key)}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <code>{`{${key}}`}</code>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
