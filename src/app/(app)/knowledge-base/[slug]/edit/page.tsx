'use client';

import React, { useState, useEffect, use } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save, Eye, X, History, Lock } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RoleKey } from '@prisma/client';

const TiptapEditor = dynamic(
  () => import('@/components/kb/tiptap-editor').then((module) => module.TiptapEditor),
  { ssr: false, loading: () => <Skeleton className="h-[360px] w-full" /> },
);

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  _count: { articles: number };
  children?: Category[];
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: string;
  locked: boolean;
  lockedRoles: string[];
  category: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
}

interface CurrentUser {
  id: string;
  roles: string[];
}

const AVAILABLE_ROLES: { value: RoleKey; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'campaignManager', label: 'Campaign Manager' },
  { value: 'podManager', label: 'Pod Manager' },
  { value: 'teamLeader', label: 'Team Leader' },
  { value: 'competitionRunner', label: 'Competition Runner' },
  { value: 'agent', label: 'Agent' },
];

export default function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [article, setArticle] = useState<Article | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [createVersion, setCreateVersion] = useState(true);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [locked, setLocked] = useState(false);
  const [lockedRoles, setLockedRoles] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  useEffect(() => {
    fetchData();
  }, [resolvedParams.slug]);

  const fetchData = async () => {
    try {
      const [articleRes, catRes, tagRes, userRes] = await Promise.all([
        fetch(`/api/kb/articles/${resolvedParams.slug}`),
        fetch('/api/kb/categories'),
        fetch('/api/kb/tags'),
        fetch('/api/auth/session'),
      ]);

      const articleData = await articleRes.json();
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      const userData = await userRes.json();

      if (!articleRes.ok) {
        throw new Error(articleData.error || 'Failed to fetch article');
      }

      const art = articleData.article;
      setArticle(art);
      setCurrentUser(userData.user);

      setCategories(catData.categories || []);
      setTags(tagData.tags || []);

      setTitle(art.title);
      setContent(art.content);
      setExcerpt(art.excerpt || '');
      setCategoryId(art.category?.id || '');
      setSelectedTags(art.tags.map((t: Tag) => t.id));
      setStatus(art.status as 'draft' | 'published');
      setLocked(art.locked);
      setLockedRoles(art.lockedRoles || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      router.push('/knowledge-base');
    } finally {
      setIsLoading(false);
    }
  };

  const buildCategoryTree = (cats: Category[], parentId: string | null = null): Category[] => {
    return cats
      .filter(c => c.parentId === parentId)
      .map(c => ({
        ...c,
        children: buildCategoryTree(cats, c.id)
      }));
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

  const handleRoleToggle = (role: string) => {
    setLockedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const canEdit = () => {
    if (!currentUser || !article) return false;
    if (currentUser.roles.includes('admin')) return true;
    if (article.locked && article.lockedRoles.length > 0) {
      const userRole = currentUser.roles[0];
      return !article.lockedRoles.includes(userRole);
    }
    return true;
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
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          excerpt,
          categoryId: categoryId || null,
          tagIds: selectedTags,
          status: finalStatus,
          locked,
          lockedRoles,
          createVersion,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update article');
      }

      const data = await res.json();
      toast({
        title: 'Success',
        description: `Article ${finalStatus === 'published' ? 'published' : 'saved'}`,
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

  const categoryTree = buildCategoryTree(categories);

  if (isLoading) {
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

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold mb-2">Article Not Found</h2>
        <Link href="/knowledge-base">
          <Button>Back to Knowledge Base</Button>
        </Link>
      </div>
    );
  }

  const canUserEdit = canEdit();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/knowledge-base/${article.slug}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Article</h1>
            <p className="text-muted-foreground">Update article content and settings</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/knowledge-base/${article.slug}/history`}>
            <Button variant="outline">
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={(e) => handleSubmit(e, 'draft')}
            disabled={isSaving || !canUserEdit}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button
            onClick={(e) => handleSubmit(e, 'published')}
            disabled={isSaving || !canUserEdit}
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
                disabled={!canUserEdit}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <div className="space-y-2">
                  <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)} disabled={!canUserEdit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categoryTree.map((cat) => (
                        <CategorySelectItem key={cat.id} category={cat} level={0} />
                      ))}
                    </SelectContent>
                  </Select>
                  {canUserEdit && (
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
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v: 'draft' | 'published') => setStatus(v)} disabled={!canUserEdit}>
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
                disabled={!canUserEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                {tags.length === 0 && newTagInput === '' ? (
                  <p className="text-sm text-muted-foreground">No tags available</p>
                ) : (
                  tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      disabled={!canUserEdit}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                        selectedTags.includes(tag.id)
                          ? 'ring-2 ring-offset-2 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      } ${!canUserEdit ? 'cursor-not-allowed' : ''}`}
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
                  ))
                )}
              </div>
              {canUserEdit && (
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
              )}
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

        {currentUser?.roles.includes('admin') && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Access Control
              </CardTitle>
              <CardDescription>Lock article editing for specific roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="locked"
                  checked={locked}
                  onCheckedChange={setLocked}
                />
                <Label htmlFor="locked">Lock this article</Label>
              </div>

              {locked && (
                <div className="space-y-2">
                  <Label>Roles that cannot edit</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.filter(r => r.value !== 'admin').map((role) => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.value}`}
                          checked={lockedRoles.includes(role.value)}
                          onCheckedChange={() => handleRoleToggle(role.value)}
                        />
                        <Label htmlFor={`role-${role.value}`} className="text-sm font-normal">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="createVersion"
                  checked={createVersion}
                  onCheckedChange={setCreateVersion}
                />
                <Label htmlFor="createVersion">Save version snapshot before changes</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {!canUserEdit && (
          <Card className="glass-card border-destructive/50">
            <CardContent className="py-4">
              <p className="text-destructive flex items-center gap-2">
                <Lock className="h-4 w-4" />
                This article is locked for your role. You can view but not edit.
              </p>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}

function CategorySelectItem({ category, level }: { category: Category; level: number }) {
  return (
    <>
      <SelectItem
        value={category.id}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {category.name}
      </SelectItem>
      {category.children?.map((child) => (
        <CategorySelectItem key={child.id} category={child} level={level + 1} />
      ))}
    </>
  );
}
