'use client';

import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TokenToolbar } from './token-toolbar';

interface TemplateEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function TemplateEditor({ content, onChange, placeholder = 'Write your template content...' }: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: parseContent(content),
    immediatelyRender: true,
    onUpdate: ({ editor }) => {
      try {
        onChange(JSON.stringify(editor.getJSON()));
      } catch {
        // ignore serialization errors
      }
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <TokenToolbar editor={editor} />
      <EditorContent editor={editor} className="p-4 min-h-[200px] tiptap-editor" />
    </div>
  );
}

function parseContent(content: string): object | string {
  if (!content) return '';
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
