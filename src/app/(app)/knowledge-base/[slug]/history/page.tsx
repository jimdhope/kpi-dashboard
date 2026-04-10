'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TiptapViewer } from '@/components/kb/tiptap-editor';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Clock,
  User,
  RotateCcw,
  Plus,
  Eye,
  Check,
  FileText
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Version {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: { id: string; name: string };
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
}

interface CurrentUser {
  id: string;
  roles: string[];
}

export default function VersionHistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [article, setArticle] = useState<Article | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  useEffect(() => {
    fetchData();
  }, [resolvedParams.slug]);

  const fetchData = async () => {
    try {
      const [articleRes, versionsRes, userRes] = await Promise.all([
        fetch(`/api/kb/articles/${resolvedParams.slug}`),
        fetch(`/api/kb/articles/${resolvedParams.slug}/versions`),
        fetch('/api/auth/session'),
      ]);

      const articleData = await articleRes.json();
      const versionsData = await versionsRes.json();
      const userData = await userRes.json();

      if (!articleRes.ok) {
        throw new Error(articleData.error || 'Failed to fetch article');
      }

      setArticle(articleData.article);
      setVersions(versionsData.versions || []);
      setCurrentUser(userData.user);
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

  const handleCreateVersion = async () => {
    setIsCreatingVersion(true);

    try {
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create version');
      }

      toast({
        title: 'Success',
        description: 'Version snapshot created',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleRestoreVersion = async (version: Version) => {
    setIsRestoring(true);

    try {
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}/versions/${version.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore version');
      }

      const data = await res.json();
      toast({
        title: 'Success',
        description: 'Version restored successfully',
      });
      router.push(`/knowledge-base/${data.article.slug}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
      setPreviewVersion(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-96" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
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
            <h1 className="text-3xl font-bold">Version History</h1>
            <p className="text-muted-foreground">{article.title}</p>
          </div>
        </div>

        <Button onClick={handleCreateVersion} disabled={isCreatingVersion}>
          {isCreatingVersion ? (
            <Clock className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Snapshot
        </Button>
      </div>

      {versions.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No versions yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Version snapshots help you track changes and restore previous content.
            </p>
            <Button onClick={handleCreateVersion} disabled={isCreatingVersion}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Snapshot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Current Version
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="default">Current</Badge>
                  <span className="text-sm text-muted-foreground">
                    The most recent version of this article
                  </span>
                </div>
                <Link href={`/knowledge-base/${article.slug}/edit`}>
                  <Button variant="outline" size="sm">
                    Edit Current
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {versions.map((version, index) => (
            <Card key={version.id} className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                      {versions.length - index}
                    </div>
                    <div>
                      <CardTitle className="text-base">{version.title}</CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {version.createdBy.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                        </span>
                        <span>
                          {format(new Date(version.createdAt), 'PPpp')}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewVersion(version)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                        <DialogHeader>
                          <DialogTitle>{version.title}</DialogTitle>
                          <DialogDescription>
                            Version from {format(new Date(version.createdAt), 'PPpp')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                          <TiptapViewer content={version.content} />
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleRestoreVersion(version)}
                            disabled={isRestoring}
                          >
                            {isRestoring ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            Restore This Version
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={currentUser?.roles.includes('admin') || currentUser?.roles.includes('teamLeader')}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Restore Version</DialogTitle>
                          <DialogDescription>
                            This will create a backup of the current version and restore the content from {format(new Date(version.createdAt), 'PPpp')}. This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setSelectedVersion(null)}>
                            Cancel
                          </Button>
                          <Button onClick={() => handleRestoreVersion(version)} disabled={isRestoring}>
                            {isRestoring ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Restore
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
