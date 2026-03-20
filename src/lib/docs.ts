import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const docsDirectory = path.join(process.cwd(), 'docs');

export interface DocMetadata {
  title: string;
  description?: string;
  category: string;
  slug: string;
  fullPath: string;
}

export interface DocContent extends DocMetadata {
  contentHtml: string;
}

export function getDocBySlug(slugArray: string[]): DocContent | null {
  try {
    const slugPath = slugArray.join('/');
    const fullPath = path.join(docsDirectory, `${slugPath}.md`);
    
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);
    
    // Default title from filename if not in frontmatter
    const title = data.title || formatSlugToTitle(slugArray[slugArray.length - 1]);
    const contentHtml = marked(content) as string;

    return {
      slug: slugPath,
      title,
      description: data.description || '',
      category: slugArray.length > 1 ? slugArray[0] : 'general',
      fullPath,
      contentHtml,
    };
  } catch (error) {
    console.error(`Error reading doc: ${slugArray.join('/')}`, error);
    return null;
  }
}

export function getAllDocs(): DocMetadata[] {
  const docs: DocMetadata[] = [];

  function traverse(dir: string, currentSlug: string[] = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath, [...currentSlug, file]);
      } else if (file.endsWith('.md')) {
        const slug = file.replace(/\.md$/, '');
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data } = matter(fileContents);
        
        docs.push({
          slug: [...currentSlug, slug].join('/'),
          title: data.title || formatSlugToTitle(slug),
          description: data.description || '',
          category: currentSlug.length > 0 ? currentSlug[0] : 'general',
          fullPath,
        });
      }
    }
  }

  traverse(docsDirectory);
  return docs;
}

function formatSlugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
