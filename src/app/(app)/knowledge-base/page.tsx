'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookOpen, PlusCircle, Search, FileText, Clock, User, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; color: string }[];
  createdBy: { id: string; name: string };
  _count: { comments: number; versions: number };
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categoryList, setCategoryList] = useState<{id: string; name: string}[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('published');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [search, selectedCategory, statusFilter]);

  const fetchArticles = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCategory && selectedCategory !== 'all') params.set('categoryId', selectedCategory);
      params.set('status', statusFilter);

      const res = await fetch(`/api/kb/articles?${params}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/kb/categories');
      const data = await res.json();
      setCategoryList(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Browse articles and helpful guides</p>
        </div>
        <Link href="/knowledge-base/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Article
          </Button>
        </Link>
      </div>

      {/* Sticky Filters Section */}
      <div className="sticky top-16 z-10">
        <Card className="glass-card">
          <CardContent className="py-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
                <Input
                  placeholder="Search articles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-48">
                <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryList.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Drafts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : articles.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {search ? 'Try a different search term' : 'Get started by creating your first article'}
                </p>
                <Link href="/knowledge-base/new">
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Article
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {articles.map((article) => (
                <Link key={article.id} href={`/knowledge-base/${article.slug}`}>
                  <Card className="glass-card hover:scale-[1.01] transition-transform cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="line-clamp-1">{article.title}</CardTitle>
                          {article.category && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {article.category.name}
                            </Badge>
                          )}
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {article.excerpt || 'No description available'}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {article.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: tag.color, color: tag.color }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {article.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{article.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {article.createdBy.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(article.updatedAt).toLocaleDateString()}
                        </span>
                        <span>{article._count.comments} comments</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
