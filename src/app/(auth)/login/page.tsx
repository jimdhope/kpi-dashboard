'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged
import { doc, getDoc } from "firebase/firestore"; // Import Firestore functions
import { db } from '@/lib/firebase'; // Import Firestore instance
import { useRouter } from 'next/navigation'; // Use App Router's router
import { Loader2, AlertCircle, LogIn } from 'lucide-react'; // Import icons
import type { AppUser, UserRole } from '@/services/user'; // Import user types
import { useToast } from '@/hooks/use-toast'; // Import useToast


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // State to track initial auth check
  const router = useRouter();
  const auth = getAuth(); // No need to pass app if initialized globally
  const { toast } = useToast(); // Get the toast function

  // Redirect logged-in users immediately
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User already logged in, attempting redirect...");
        await handleRedirect(user.uid); // Attempt redirect
      }
       setIsCheckingAuth(false); // Auth check complete
    });
    return () => unsubscribe(); // Cleanup listener
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Function to fetch user roles and handle redirection
  const handleRedirect = async (userId: string) => {
      console.log(`Fetching roles for user ID: ${userId}`);
      try {
          const userDocRef = doc(db, 'users', userId);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
              const userData = userDocSnap.data() as AppUser;
              const userRoles = userData.roles || [];
              console.log(`User roles found: ${userRoles.join(', ')}`);

              // --- Role-Based Redirection Logic ---
              if (userRoles.includes('admin') || userRoles.includes('podManager') || userRoles.includes('teamLeader')) {
                  console.log('Redirecting admin/manager/leader user to /admin');
                  router.push('/admin');
              } else if (userRoles.includes('agent')) {
                  console.log('Redirecting agent user to /agent');
                  router.push('/agent');
              } else {
                   console.warn(`User ${userId} logged in but has no defined roles for redirection. Defaulting to /agent.`);
                   toast({
                       title: "Redirection Issue",
                       description: "Could not determine your role. Redirecting to default.",
                       variant: "destructive",
                    });
                  router.push('/agent'); // Fallback redirection
              }
          } else {
               console.error(`User document not found in Firestore for UID: ${userId}`);
               setError("Could not find your user profile data. Please contact support.");
               setLoading(false); // Ensure loading stops if profile not found
          }
      } catch (err) {
           console.error("Error fetching user roles or redirecting:", err);
           setError("An error occurred during login. Please try again.");
           setLoading(false); // Ensure loading stops on error
      }
  };


   const handleEmailPasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault(); // Prevent default form submission
    setError(null);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Login successful
      const user = userCredential.user;
      console.log('Login successful for:', user.email);

       // Fetch roles and redirect
       await handleRedirect(user.uid);

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
       setLoading(false); // Stop loading on error
    }
    // No finally setLoading(false) here, redirect handles it or error case does
  };

   // Show loading indicator while checking auth state
   if (isCheckingAuth) {
       return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="********" // Added placeholder
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
            {/* Removed the paragraph below */}
            {/* <p className="mt-4 text-center text-xs text-muted-foreground">
                Login with any valid Firebase user.
            </p> */}
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
