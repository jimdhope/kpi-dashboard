
import type { EditorThemeClasses } from 'lexical';

export const editorTheme: EditorThemeClasses = {
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph mb-2', // Add margin bottom to paragraphs
  quote: 'editor-quote',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
    h4: 'editor-heading-h4',
    h5: 'editor-heading-h5',
  },
  list: {
    nested: {
      listitem: 'editor-nested-listitem',
    },
    ol: 'editor-list-ol',
    ul: 'editor-list-ul',
    listitem: 'editor-listitem',
    listitemChecked: 'editor-listitemChecked',
    listitemUnchecked: 'editor-listitemUnchecked',
  },
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold font-bold',
    italic: 'editor-text-italic italic',
    underline: 'editor-text-underline underline',
    strikethrough: 'editor-text-strikethrough line-through',
    underlineStrikethrough: 'editor-text-underlineStrikethrough',
    code: 'editor-text-code',
  },
  code: 'editor-code',
  // Add any other theme classes you need
};
