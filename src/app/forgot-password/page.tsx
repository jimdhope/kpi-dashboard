'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, LogIn } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setSubmitted(false);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const payload = await response.json();
        setError(payload.error || 'Failed to send password reset email.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Forgot Your Password?</CardTitle>
          <CardDescription>
            No problem. Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <Alert className="border-green-500 bg-green-50 text-green-800 dark:border-green-600 dark:bg-green-950 dark:text-green-300">
              <Mail className="h-4 w-4 !text-green-600" />
              <AlertDescription>
                If an account with this email exists, a password reset link has been sent. Please check your inbox (and spam folder).
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <Button variant="link" size="sm" asChild>
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4"/>
              Back to Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
