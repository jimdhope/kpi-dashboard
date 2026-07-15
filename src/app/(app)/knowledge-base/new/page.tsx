'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ArrowLeft, Eye, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const TiptapEditor = dynamic(
  () => import('@/components/kb/tiptap-editor').then((module) => module.TiptapEditor),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full" /> },
);

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export default function NewArticlePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/kb/categories'),
        fetch('/api/kb/tags'),
      ]);
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      setCategories(catData.categories || []);
      setTags(tagData.tags || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagInput.trim()) return;
    
    const existingTag = tags.find(t => t.name.toLowerCase() === newTagInput.trim().toLowerCase());
    if (existingTag) {
      if (!selectedTags.includes(existingTag.id)) {
        setSelectedTags(prev => [...prev, existingTag.id]);
      }
      setNewTagInput('');
      return;
    }

    setIsCreatingTag(true);
    try {
      const res = await fetch('/api/kb/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagInput.trim(), color: '#6366f1' }),
      });
      const data = await res.json();
      if (res.ok) {
        setTags(prev => [...prev, data.tag]);
        setSelectedTags(prev => [...prev, data.tag.id]);
        setNewTagInput('');
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryInput.trim()) return;
    
    const existingCat = categories.find(c => c.name.toLowerCase() === newCategoryInput.trim().toLowerCase());
    if (existingCat) {
      setCategoryId(existingCat.id);
      setNewCategoryInput('');
      return;
    }

    setIsCreatingCategory(true);
    try {
      const res = await fetch('/api/kb/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories(prev => [...prev, data.category]);
        setCategoryId(data.category.id);
        setNewCategoryInput('');
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, newStatus?: 'draft' | 'published') => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    const finalStatus = newStatus || status;
    setIsSaving(true);

    try {
      const res = await fetch('/api/kb/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          excerpt,
          categoryId: categoryId || null,
          tagIds: selectedTags,
          status: finalStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create article');
      }

      const data = await res.json();
      toast({
        title: 'Success',
        description: `Article ${finalStatus === 'published' ? 'published' : 'saved as draft'}`,
      });
      router.push(`/knowledge-base/${data.article.slug}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isSaving) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-96" />
        <Card className="glass-card">
          <CardContent className="py-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/knowledge-base">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">New Article</h1>
            <p className="text-muted-foreground">Create a new knowledge base article</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button
            onClick={(e) => handleSubmit(e, 'published')}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Publish
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Article Details</CardTitle>
            <CardDescription>Basic information about your article</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter article title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <div className="space-y-2">
                  <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or create new category..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                    />
                    <Button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryInput.trim() || isCreatingCategory}
                      size="sm"
                    >
                      {isCreatingCategory ? '...' : 'Add'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v: 'draft' | 'published') => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                placeholder="Brief description of the article"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagToggle(tag.id)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                      selectedTags.includes(tag.id)
                        ? 'ring-2 ring-offset-2 ring-offset-background'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: `${tag.color}20`,
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                    {selectedTags.includes(tag.id) && (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add new tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={!newTagInput.trim() || isCreatingTag}
                  size="sm"
                >
                  {isCreatingTag ? 'Creating...' : 'Add Tag'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Write your article content using the rich text editor</CardDescription>
          </CardHeader>
          <CardContent>
            <TiptapEditor
              content={content}
              onChange={setContent}
              placeholder="Start writing your article..."
            />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
