'use client';

import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

export function EmojiPickerField({ value, onChange, placeholder = 'Choose emoji' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-start gap-2 font-normal">
          <span className="text-xl">{value || '🙂'}</span>
          {!value && <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <EmojiPicker onEmojiClick={(emoji) => onChange(emoji.emoji)} />
        {value && <Button type="button" variant="ghost" size="sm" className="m-2" onClick={() => onChange('')}>Clear</Button>}
      </PopoverContent>
    </Popover>
  );
}
