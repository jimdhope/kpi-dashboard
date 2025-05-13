
'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
  TextFormatType,
} from 'lexical';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Bold, Italic, Underline, Undo, Redo } from 'lucide-react';
import { LowPriority } from 'react-dom/src/Scheduler';
import {UNDO_COMMAND, REDO_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND} from 'lexical';

export function LexicalToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);


  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

   useEffect(() => {
    let unregisterCanUndo = () => {};
    let unregisterCanRedo = () => {};

    if (editor !== null) {
      unregisterCanUndo = editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL, // Use COMMAND_PRIORITY_CRITICAL
      );

      unregisterCanRedo = editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL, // Use COMMAND_PRIORITY_CRITICAL
      );
    }
    return () => {
      unregisterCanUndo();
      unregisterCanRedo();
    };
  }, [editor]);


  const toggleFormat = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  return (
    <div className="flex items-center gap-1 p-2 border-b bg-muted/50 rounded-t-md">
      <Button
        variant={isBold ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => toggleFormat('bold')}
        aria-label="Bold"
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant={isItalic ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => toggleFormat('italic')}
        aria-label="Italic"
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant={isUnderline ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => toggleFormat('underline')}
        aria-label="Underline"
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>
       <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}
