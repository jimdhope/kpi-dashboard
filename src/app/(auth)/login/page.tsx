
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import type { AppUser } from '@/services/user';
import { useToast } from '@/hooks/use-toast';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const auth = getAuth();
  const { toast } = useToast();

  const handleRedirect = async (userId: string) => {
      console.log(`Fetching roles for user ID: ${userId}`);
      try {
          const userDocRef = doc(db, 'users', userId);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
              const userData = userDocSnap.data() as AppUser;
              const userRoles = userData.roles || [];
              console.log(`User roles found: ${userRoles.join(', ')}`);

              if (userRoles.includes('admin') || userRoles.includes('podManager') || userRoles.includes('teamLeader')) {
                  router.push('/admin');
              } else if (userRoles.includes('agent')) {
                  router.push('/agent');
              } else {
                   toast({
                       title: "Redirection Issue",
                       description: "Could not determine your role. Redirecting to default.",
                       variant: "destructive",
                    });
                  router.push('/agent');
              }
          } else {
               setError("Could not find your user profile data. Please contact support.");
               setLoading(false);
          }
      } catch (err) {
           console.error("Error fetching user roles or redirecting:", err);
           setError("An error occurred during login. Please try again.");
           setLoading(false);
      }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await handleRedirect(user.uid);
      }
       setIsCheckingAuth(false);
    });
    return () => unsubscribe();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

   const handleEmailPasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Login successful for:', user.email);
      await handleRedirect(user.uid);
    } catch (err: any) {
      console.error("Email/Password Login Error:", err);
       if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
         setError('Invalid email or password. Please check your credentials and try again.');
       } else if (err.code === 'auth/too-many-requests') {
         setError('Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.');
       } else {
        setError(err.message || 'Failed to log in.');
      }
       setLoading(false);
    }
  };

   if (isCheckingAuth) {
       return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

  return (
    <Card className="w-full max-w-md shadow-xl">
    <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Login to KPI Quest</CardTitle>
        <CardDescription>Enter your credentials below</CardDescription>
    </CardHeader>
    <CardContent>
        {error && (
            <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
            <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
            />
            </div>
            <div className="grid gap-2">
                 <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <Link
                        href="/forgot-password"
                        className="ml-auto inline-block text-xs underline"
                    >
                        Forgot your password?
                    </Link>
                </div>
            <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="********"
            />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                <LogIn className="mr-2 h-4 w-4" />
                )}
            {loading ? 'Signing in...' : 'Login'}
            </Button>
        </form>
    </CardContent>
    <CardFooter className="text-center text-sm text-muted-foreground">
        Need help? Contact support.
    </CardFooter>
    </Card>
  );
}
