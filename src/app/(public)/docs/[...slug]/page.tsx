import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getDocBySlug } from '@/lib/docs';

interface DocPageProps {
  params: {
    slug: string[];
  };
}

export default function DocPage({ params }: DocPageProps) {
  const { slug } = params;

  if (!slug || slug.length === 0) {
    redirect('/docs/blueprint');
  }

  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  return (
    <article className="max-w-3xl">
      <div className="mb-8 border-b pb-8">
        <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2 capitalize">
          {doc.category.replace(/-/g, ' ')}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
          {doc.title}
        </h1>
        {doc.description && (
          <p className="text-xl text-muted-foreground leading-relaxed">
            {doc.description}
          </p>
        )}
      </div>
      
      <div 
        className="prose prose-teal dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary hover:prose-a:underline prose-pre:bg-muted prose-pre:text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: doc.contentHtml }}
      />
    </article>
  );
}

export async function generateStaticParams() {
  const { getAllDocs } = require('@/lib/docs');
  const docs = getAllDocs();
  
  return docs.map((doc: any) => ({
    slug: doc.slug.split('/'),
  }));
}
