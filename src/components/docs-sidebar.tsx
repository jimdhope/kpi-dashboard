'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DocMetadata } from '@/lib/docs';
import { ChevronRight, BookOpen, Terminal, GraduationCap } from 'lucide-react';

interface DocsSidebarProps {
  docs: DocMetadata[];
}

export function DocsSidebar({ docs }: DocsSidebarProps) {
  const pathname = usePathname();

  // Group docs by category
  const categories = docs.reduce((acc, doc) => {
    const category = doc.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, DocMetadata[]>);

  const categoryIcons: Record<string, React.ElementType> = {
    tutorials: GraduationCap,
    developer: Terminal,
    general: BookOpen,
  };

  const categoryLabels: Record<string, string> = {
    tutorials: 'Tutorials',
    developer: 'Developer Guides',
    general: 'Getting Started',
  };

  return (
    <aside className="w-full h-full py-6 pr-4 overflow-y-auto">
      <div className="space-y-8">
        {Object.entries(categories).map(([category, categoryDocs]) => {
          const Icon = categoryIcons[category] || BookOpen;
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 px-2 text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                <Icon className="w-4 h-4" />
                <span>{categoryLabels[category] || category}</span>
              </div>
              <ul className="space-y-1">
                {categoryDocs.map((doc) => {
                  const href = `/docs/${doc.slug}`;
                  const isActive = pathname === href;
                  return (
                    <li key={doc.slug}>
                      <Link
                        href={href}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <ChevronRight className={cn(
                          "w-3 h-3 transition-transform",
                          isActive ? "rotate-90 text-primary" : "text-muted-foreground/50 group-hover:text-foreground/70"
                        )} />
                        {doc.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
