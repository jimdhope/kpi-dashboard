'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuth, signInWithPopup, OAuthProvider } from "firebase/auth"; // Import OAuthProvider
import { app } from '@/lib/firebase'; // Assuming firebase setup is in lib/firebase.ts
import { useRouter } from 'next/navigation'; // Use App Router's router
import { Loader2, AlertCircle } from 'lucide-react'; // Import icons

// Basic Microsoft Icon SVG - replace with a better one if available or use text
const MicrosoftIcon = () => (
 <svg className="mr-2 h-4 w-4" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23">
    <title>Microsoft</title>
    <path fill="#f3f3f3" d="M0 0h11v11H0z"/>
    <path fill="#F25022" d="M1 1h9v9H1z"/>
    <path fill="#f3f3f3" d="M12 0h11v11H12z"/>
    <path fill="#7FBA00" d="M13 1h9v9h-9z"/>
    <path fill="#f3f3f3" d="M0 12h11v11H0z"/>
    <path fill="#00A4EF" d="M1 13h9v9H1z"/>
    <path fill="#f3f3f3" d="M12 12h11v11H12z"/>
    <path fill="#FFB900" d="M13 13h9v9h-9z"/>
  </svg>
);

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const microsoftProvider = new OAuthProvider('microsoft.com'); // Create Microsoft provider

  // Optional: Customize OAuth scopes or parameters if needed
  // microsoftProvider.addScope('mail.read');
  // microsoftProvider.setCustomParameters({
  //   // Prompt user to select an account.
  //   prompt: 'select_account'
  // });

   const handleMicrosoftLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, microsoftProvider);
      // The signed-in user info.
      const user = result.user;
      console.log('Microsoft Login successful for:', user.displayName, 'redirecting...');
       // TODO: Check if user exists in our system and redirect based on role (admin/agent)
       // This might involve fetching user role from Firestore/Database after login
      router.push('/admin'); // Default redirect to admin for now
    } catch (err: any) {
      console.error("Microsoft Login Error:", err);
       // Handle specific errors like account exists with different credential
       if (err.code === 'auth/account-exists-with-different-credential') {
         setError('An account already exists with the same email address but different sign-in credentials. Try signing in with the original method.');
       } else if (err.code === 'auth/popup-closed-by-user') {
         setError('Login cancelled. The login window was closed.');
       } else {
        setError(err.message || 'Failed to log in with Microsoft.');
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
          <CardDescription>Sign in using your Microsoft 365 account</CardDescription>
        </CardHeader>
        <CardContent>
           {error && (
             <Alert variant="destructive" className="mb-6">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription>{error}</AlertDescription>
             </Alert>
           )}
           <Button variant="outline" className="w-full" onClick={handleMicrosoftLogin} disabled={loading}>
               {loading ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               ) : (
                 <MicrosoftIcon />
               )}
              {loading ? 'Signing in...' : 'Login with Microsoft 365'}
           </Button>
        </CardContent>
         <CardFooter className="text-center text-sm text-muted-foreground">
           Need help? Contact support. {/* Optional footer text */}
        </CardFooter>
      </Card>
    </div>
  );
}
