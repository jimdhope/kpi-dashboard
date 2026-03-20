import React from 'react';
import { DocsSidebar } from '@/components/docs-sidebar';
import { getAllDocs } from '@/lib/docs';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docs = getAllDocs();

  return (
    <div className="container mx-auto px-4 md:px-6">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r">
          <DocsSidebar docs={docs} />
        </div>
        <div className="flex-1 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
