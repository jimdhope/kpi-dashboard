'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { TiptapToolbar } from './tiptap-toolbar';
import { AlertCircle } from 'lucide-react';

function parseEditorContent(content: string | undefined | null): object | string {
  if (!content) return '';
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

interface TiptapEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  maxLength?: number;
  editable?: boolean;
}

export function TiptapEditor({
  content = '',
  onChange,
  placeholder = 'Start writing...',
  maxLength,
  editable = true,
}: TiptapEditorProps) {
  const [hasError, setHasError] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer',
          },
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Color,
      TextStyle,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-md max-w-full',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount.configure({
        limit: maxLength,
      }),
      Typography,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TableKit,
    ],
    content: parseEditorContent(content),
    immediatelyRender: true,
    editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        try {
          onChange(JSON.stringify(editor.getJSON()));
          setHasError(false);
        } catch {
          setHasError(true);
        }
      }
    },
  });

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editor) {
        const reader = new FileReader();
        reader.onload = () => {
          editor.chain().focus().setImage({ src: reader.result as string }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [editor]);

  const handleVideoEmbed = useCallback(() => {
    const url = window.prompt('Enter video URL:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  }, [editor]);

  if (hasError) {
    return (
      <div className="border rounded-lg overflow-hidden bg-card p-4">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Content format error. Please re-save your content.</span>
        </div>
        <EditorContent editor={editor} className="p-4" />
      </div>
    );
  }

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <TiptapToolbar 
        editor={editor} 
        onImageUpload={handleImageUpload}
        onVideoEmbed={handleVideoEmbed}
        onInsertTable={insertTable}
      />
      <EditorContent editor={editor} className="p-4 min-h-[300px] tiptap-editor" />
      {maxLength && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {editor.storage.characterCount?.characters?.() || 0} / {maxLength} characters
        </div>
      )}
    </div>
  );
}

export function TiptapViewer({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: true,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer',
          },
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Color,
      TextStyle,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-md max-w-full',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TableKit,
    ],
    content: parseEditorContent(content),
    immediatelyRender: false,
    editable: false,
  });

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} className="prose prose-invert max-w-none tiptap-editor" />;
}
