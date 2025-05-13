
'use client';

import type { EditorState, LexicalEditor } from 'lexical';
import { $getRoot, $getSelection, $isRangeSelection, COMMAND_PRIORITY_CRITICAL, SELECTION_CHANGE_COMMAND, FORMAT_TEXT_COMMAND, $isElementNode, ElementNode, $createParagraphNode } from 'lexical';
import { useEffect, useState, useCallback } from 'react';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
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

function HtmlPlugin({
  initialHtml,
  setHtml,
  editable,
}: {
  initialHtml?: string;
  setHtml: (html: string) => void;
  editable?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (isFirstRender && initialHtml && editable) {
      setIsFirstRender(false);
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
    }
  }, [editor, initialHtml, isFirstRender, editable]);

  const handleOnChange = useCallback(
    (editorState: EditorState) => {
      if (editable) {
        editorState.read(() => {
          const htmlString = $generateHtmlFromNodes(editor, null);
          setHtml(htmlString);
        });
      }
    },
    [editor, setHtml, editable]
  );

  return <OnChangePlugin onChange={handleOnChange} />;
}


export function KpiQuestLexicalEditor({ initialHtml, onChange, editable = true }: LexicalEditorProps) {
  const [htmlString, setHtmlString] = useState(initialHtml || '<p><br></p>'); // Default to an empty paragraph

  useEffect(() => {
    onChange(htmlString);
  }, [htmlString, onChange]);

  // Handler to update htmlString when Lexical content changes
  const handleLexicalChange = (newHtml: string) => {
    setHtmlString(newHtml);
  };

  return (
    <LexicalComposer initialConfig={{ ...editorConfig, editable }}>
      <div className="lexical-editor-container border rounded-md">
        {editable && <LexicalToolbar />}
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
        <HtmlPlugin initialHtml={initialHtml} setHtml={handleLexicalChange} editable={editable} />
      </div>
    </LexicalComposer>
  );
}

