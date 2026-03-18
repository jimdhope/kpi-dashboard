
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, LogIn } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Schema for the form
const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const auth = getAuth();
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handlePasswordReset = async (data: ForgotPasswordFormData) => {
    setLoading(true);
    setSubmitted(false);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setSubmitted(true); // Show success message
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send password reset email.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Forgot Your Password?</CardTitle>
        <CardDescription>
          No problem. Enter your email and we'll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <Alert variant="default" className="border-green-500 bg-green-50 text-green-800 dark:border-green-600 dark:bg-green-950 dark:text-green-300">
             <Mail className="h-4 w-4 !text-green-600" />
            <AlertDescription>
              If an account with this email exists, a password reset link has been sent. Please check your inbox (and spam folder).
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePasswordReset)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          </Form>
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
  );
}
