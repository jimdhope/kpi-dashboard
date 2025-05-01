'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { app } from '@/lib/firebase'; // Assuming firebase setup is in lib/firebase.ts
import { useRouter } from 'next/navigation'; // Use App Router's router
import { Loader2, AlertCircle } from 'lucide-react'; // Import icons

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // TODO: Redirect based on user role (admin/agent) after successful login
      // This might involve fetching user role from Firestore/Database after login
      console.log('Login successful, redirecting...');
      router.push('/admin'); // Default redirect to admin for now
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
        setLoading(false);
    }
  };

   const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // The signed-in user info.
      const user = result.user;
      console.log('Google Login successful for:', user.displayName, 'redirecting...');
       // TODO: Check if user exists in our system and redirect based on role
      router.push('/agent'); // Default redirect to agent for Google sign-in for now
    } catch (err: any) {
      console.error("Google Login Error:", err);
       // Handle specific errors like account exists with different credential
       if (err.code === 'auth/account-exists-with-different-credential') {
         setError('An account already exists with the same email address but different sign-in credentials. Try signing in with the original method.');
       } else {
        setError(err.message || 'Failed to log in with Google.');
      }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Login to KpiQuest</CardTitle>
          <CardDescription>Enter your credentials below</CardDescription>
        </CardHeader>
        <CardContent>
           {error && (
             <Alert variant="destructive" className="mb-4">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription>{error}</AlertDescription>
             </Alert>
           )}
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                 <Label htmlFor="password">Password</Label>
                 {/* Optional: Add Forgot Password link */}
                 {/* <Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link> */}
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
            <div className="relative my-6">
             <div className="absolute inset-0 flex items-center">
               <span className="w-full border-t" />
             </div>
             <div className="relative flex justify-center text-xs uppercase">
               <span className="bg-background px-2 text-muted-foreground">
                 Or continue with
               </span>
             </div>
           </div>
           <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
               {loading ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               ) : (
                 // Basic Google Icon SVG - replace with a better one if available
                 <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                   <title>Google</title>
                   <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.86 1.93-4.97 1.93-3.87 0-7.02-3.1-7.02-6.93s3.15-6.93 7.02-6.93c2.21 0 3.66.87 4.54 1.74l2.4-2.33C18.37 2.58 15.87 1.5 12.48 1.5 7.01 1.5 3 5.84 3 11.35s4.01 9.85 9.48 9.85c2.86 0 5.33-.95 7.13-2.76 1.9-1.87 2.58-4.47 2.58-6.88 0-.7-.07-1.36-.2-1.98h-9.1z" fill="#4285F4"/>
                 </svg>
               )}
              Login with Google
           </Button>
        </CardContent>
        <CardFooter className="text-center text-sm">
           {/* Optional: Add Sign up link */}
           {/* Don't have an account? <Link href="/signup" className="text-primary hover:underline ml-1">Sign up</Link> */}
        </CardFooter>
      </Card>
    </div>
  );
}
