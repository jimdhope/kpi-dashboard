'use client';

import type { EditorState, LexicalEditor } from 'lexical';
import { $getRoot, $getSelection, $isRangeSelection, COMMAND_PRIORITY_CRITICAL, SELECTION_CHANGE_COMMAND, FORMAT_TEXT_COMMAND, $isElementNode, ElementNode, $createParagraphNode } from 'lexical';
import { useEffect, useState, useCallback } from 'react';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
// OnChangePlugin is not used directly if HtmlPlugin handles onChange logic
// import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'; 
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';

import { editorTheme } from './LexicalTheme';
import { editorNodes } from './LexicalNodes';
import { LexicalToolbar } from './LexicalToolbar';
import { ScrollArea } from './ui/scroll-area';

interface LexicalEditorProps {
  initialHtml?: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

const editorConfig = {
  namespace: 'KpiQuestLexicalEditor',
  theme: editorTheme,
  onError(error: Error) {
    console.error("Lexical editor error:", error);
  },
  nodes: editorNodes,
};

// Plugin to set the initial HTML content and handle updates
function HtmlPlugin({
  initialHtml,
  onHtmlChange, // Renamed from setHtml for clarity, this will be field.onChange from RHF
  isEditorEditable, // Renamed from editable for clarity within this plugin's scope
}: {
  initialHtml?: string;
  onHtmlChange: (html: string) => void;
  isEditorEditable: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Effect to load initial HTML when the editor is ready and initialHtml is provided
  useEffect(() => {
    if (editor && initialHtml && !hasInitialized) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        nodes.forEach((n) => {
            if ($isElementNode(n)) {
              root.append(n as ElementNode);
            } else {
              const paragraphNode = $createParagraphNode();
              paragraphNode.append(n);
              root.append(paragraphNode);
            }
        });
      });
      setHasInitialized(true); // Mark as initialized
    }
  }, [editor, initialHtml, hasInitialized]);

  // Effect to listen for changes and call onHtmlChange if the editor is editable
  useEffect(() => {
    if (!isEditorEditable || !editor) return; // Don't listen if not editable or editor not ready

    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const htmlString = $generateHtmlFromNodes(editor, null);
        onHtmlChange(htmlString); // Call the passed onChange (e.g., RHF's field.onChange)
      });
    });

    return () => {
      removeUpdateListener();
    };
  }, [editor, onHtmlChange, isEditorEditable]);

  return null;
}

// Component to manage the editable state of the editor instance
function EditorEditableStatePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null; // This plugin doesn't render anything
}


export function KpiQuestLexicalEditor({ initialHtml, onChange, editable = true }: LexicalEditorProps) {
  // react-hook-form (via the `onChange` prop which is `field.onChange`) is the source of truth for the HTML content.
  // No need for an internal `htmlString` state in this component for the content itself.

  return (
    <LexicalComposer initialConfig={{ ...editorConfig, editable /* Pass the editable prop for initial state */ }}>
      <div className="lexical-editor-container border rounded-md">
        {editable && <LexicalToolbar />} {/* Toolbar only shown if editable */}
        <ScrollArea className="h-64 w-full relative"> {/* Set a fixed height for scrollability */}
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="lexical-content-editable p-2 min-h-[150px] focus:outline-none focus:ring-1 focus:ring-ring rounded-b-md" />
            }
            placeholder={
              <div className="lexical-placeholder p-2 absolute top-0 left-0 text-muted-foreground pointer-events-none">
                Enter your message content...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </ScrollArea>
        <HistoryPlugin />
        {/* Pass the main `onChange` (from react-hook-form) to HtmlPlugin */}
        <HtmlPlugin
          initialHtml={initialHtml}
          onHtmlChange={onChange} // This is likely field.onChange from RHF
          isEditorEditable={editable}
        />
        <EditorEditableStatePlugin editable={editable} /> {/* Manages editor.setEditable */}
      </div>
    </LexicalComposer>
  );
}