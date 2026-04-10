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
  Edit,
  Clock,
  User,
  Eye,
  MessageSquare,
  History,
  Lock,
  Unlock,
  MoreHorizontal,
  Send,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
  replies: Comment[];
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
  views: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; color: string }[];
  createdBy: { id: string; name: string; email: string };
  versions: { id: string; createdAt: string; createdBy: { name: string } }[];
  comments: Comment[];
  _count: { comments: number; versions: number };
}

interface CurrentUser {
  id: string;
  roles: string[];
}

export default function ArticleViewPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [article, setArticle] = useState<Article | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  useEffect(() => {
    fetchArticle();
    fetchUser();
  }, [resolvedParams.slug]);

  const fetchArticle = async () => {
    try {
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/knowledge-base');
          return;
        }
        throw new Error('Failed to fetch article');
      }
      const data = await res.json();
      setArticle(data.article);
    } catch (error) {
      console.error('Error fetching article:', error);
      toast({
        title: 'Error',
        description: 'Failed to load article',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete article');
      }

      toast({
        title: 'Success',
        description: 'Article deleted',
      });
      router.push('/knowledge-base');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleLock = async () => {
    if (!article) return;

    try {
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !article.locked }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update article');
      }

      const data = await res.json();
      setArticle({ ...article, ...data.article });
      toast({
        title: 'Success',
        description: article.locked ? 'Article unlocked' : 'Article locked',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = async (parentId?: string) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    setIsSubmittingComment(true);

    try {
      const res = await fetch(`/api/kb/articles/${resolvedParams.slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add comment');
      }

      setNewComment('');
      setReplyContent('');
      setReplyingTo(null);
      fetchArticle();
      toast({
        title: 'Success',
        description: 'Comment added',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold mb-2">Article Not Found</h2>
        <p className="text-muted-foreground mb-4">The article you are looking for does not exist.</p>
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
          <Link href="/knowledge-base">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{article.title}</h1>
              {article.status === 'draft' && (
                <Badge variant="secondary">Draft</Badge>
              )}
              {article.locked && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {article.createdBy.name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Updated {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true })}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {article.views} views
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {article._count.comments} comments
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/knowledge-base/${article.slug}/history`}>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-1" />
              History ({article._count.versions})
            </Button>
          </Link>

          {canEdit() && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleLock}
              >
                {article.locked ? (
                  <>
                    <Unlock className="h-4 w-4 mr-1" />
                    Unlock
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-1" />
                    Lock
                  </>
                )}
              </Button>

              <Link href={`/knowledge-base/${article.slug}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </>
          )}

          {currentUser?.roles.includes('admin') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Article
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {article.category && (
                  <Badge variant="secondary">{article.category.name}</Badge>
                )}
                {article.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>

              {article.excerpt && (
                <p className="text-lg text-muted-foreground mb-6 border-l-4 border-primary pl-4">
                  {article.excerpt}
                </p>
              )}

              <div className="prose prose-invert max-w-none">
                <TiptapViewer content={article.content} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="cursor-pointer" onClick={() => setShowComments(!showComments)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <CardTitle className="text-lg">
                    Comments ({article._count.comments})
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm">
                  {showComments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {showComments && (
              <CardContent className="space-y-4">
                {currentUser && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={2}
                    />
                    <Button
                      onClick={() => handleAddComment()}
                      disabled={!newComment.trim() || isSubmittingComment}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {article.comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {article.comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        currentUser={currentUser}
                        replyingTo={replyingTo}
                        replyContent={replyContent}
                        setReplyingTo={setReplyingTo}
                        setReplyContent={setReplyContent}
                        onReply={handleAddComment}
                        slug={article.slug}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUser,
  replyingTo,
  replyContent,
  setReplyingTo,
  setReplyContent,
  onReply,
  slug,
}: {
  comment: Comment;
  currentUser: CurrentUser | null;
  replyingTo: string | null;
  replyContent: string;
  setReplyingTo: (id: string | null) => void;
  setReplyContent: (content: string) => void;
  onReply: (parentId?: string) => void;
  slug: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kb/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !comment.resolved }),
      });

      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error resolving comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;

    try {
      const res = await fetch(`/api/kb/comments/${comment.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <div className={`space-y-2 ${comment.resolved ? 'opacity-50' : ''}`}>
      <div className="flex gap-2">
        <div className="flex-1 bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">{comment.createdBy.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-2 mt-2">
            {currentUser && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                Reply
              </Button>
            )}
            {currentUser?.roles.includes('admin') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleResolve}
                disabled={isSubmitting}
              >
                <Check className="h-3 w-3 mr-1" />
                {comment.resolved ? 'Unresolve' : 'Resolve'}
              </Button>
            )}
            {(currentUser?.id === comment.createdBy.id || currentUser?.roles.includes('admin')) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="flex gap-2 ml-8">
          <Textarea
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              onClick={() => onReply(comment.id)}
              disabled={!replyContent.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setReplyingTo(null);
                setReplyContent('');
              }}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="ml-8 space-y-2 mt-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{reply.createdBy.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
