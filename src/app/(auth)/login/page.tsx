'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"; // Import email/password auth
import { app } from '@/lib/firebase'; // Assuming firebase setup is in lib/firebase.ts
import { useRouter } from 'next/navigation'; // Use App Router's router
import { Loader2, AlertCircle, LogIn } from 'lucide-react'; // Import icons

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);

   const handleEmailPasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission
    setError(null);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Login successful
      const user = userCredential.user;
      console.log('Login successful for:', user.email);

      // --- Mock Role Check for Testing ---
      // In a real app, you'd fetch the user's role from Firestore or a custom claim
      if (user.email === 'admin@test.com') {
        console.log('Redirecting admin user...');
        router.push('/admin');
      } else if (user.email === 'agent@test.com') {
         console.log('Redirecting agent user...');
        router.push('/agent');
      } else {
        console.warn(`User ${user.email} logged in but has no defined role for redirection. Defaulting to agent.`);
        // Decide on a default redirect or show an error if role is unknown
        router.push('/agent');
      }
      // -----------------------------------

    } catch (err: any) {
      console.error("Email/Password Login Error:", err);
      // Handle specific Firebase auth errors
       if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
         setError('Invalid email or password. Please try again.');
       } else if (err.code === 'auth/too-many-requests') {
         setError('Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.');
       } else {
        setError(err.message || 'Failed to log in.');
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
                <Label htmlFor="password">Password</Label>
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
                 {loading ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                 )}
                {loading ? 'Signing in...' : 'Login'}
             </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
                Use `admin@test.com` or `agent@test.com` for testing. <br />
                (Ensure users exist in Firebase Auth emulator)
            </p>
        </CardContent>
         <CardFooter className="text-center text-sm text-muted-foreground">
           {/* Optional: Add forgot password link */}
           {/* <Link href="/forgot-password" className="underline">Forgot password?</Link> */}
           Need help? Contact support.
        </CardFooter>
      </Card>
    </div>
  );
}
