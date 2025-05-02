
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Keep Label for general use if needed
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PasswordInput } from './ui/password-input'; // Import PasswordInput
import { Loader2 } from 'lucide-react';
import type { AppUser } from '@/services/user'; // Import AppUser type

// Define available user roles
export const USER_ROLES = ['admin', 'podManager', 'teamLeader', 'agent'] as const;
export type UserRole = typeof USER_ROLES[number];

// Define the validation schema using Zod
// Add 'mode' field to distinguish between 'add' and 'edit'
const userFormSchemaBase = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }).max(50, { message: 'Name must be 50 characters or less.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  role: z.enum(USER_ROLES, { required_error: 'Please select a role.' }),
  // Password is required only in 'add' mode
  password: z.string().optional(),
  // Add other user fields if needed (e.g., avatarUrl)
});

// Conditional validation for password based on mode
const userFormSchema = userFormSchemaBase.superRefine((data, ctx) => {
    // In a real 'edit' mode, password wouldn't typically be required or possibly even shown.
    // For 'add' mode simulation here, we make it required.
    // A more robust solution would pass the mode ('add' or 'edit') to the form.
    // For simplicity now, let's assume this form is primarily for 'add'.
    if (!data.password || data.password.length < 6) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password is required and must be at least 6 characters.',
            path: ['password'],
         });
    }
});


// Type for form data based on the schema
export type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  onSubmit: (data: UserFormData) => Promise<void> | void;
  onCancel: () => void;
  initialData?: AppUser; // Optional initial data for editing
  mode: 'add' | 'edit'; // Explicitly define the mode
}

export function UserForm({ onSubmit, onCancel, initialData, mode }: UserFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<UserFormData>({
        resolver: zodResolver(userFormSchema), // Apply conditional schema if needed based on mode
        defaultValues: {
            name: initialData?.name || '',
            email: initialData?.email || '',
            role: initialData?.role as UserRole || undefined, // Cast role
            password: '', // Always clear password field initially
        },
        mode: 'onChange', // Validate on change
    });

  // Reset form if initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && mode === 'edit') {
      form.reset({
        name: initialData.name,
        email: initialData.email,
        role: initialData.role as UserRole,
        password: '', // Don't pre-fill password in edit mode
      });
    } else if (mode === 'add') {
        form.reset({
            name: '',
            email: '',
            role: undefined,
            password: '',
        });
    }
    // Adjust schema resolver based on mode if needed here
  }, [initialData, mode, form]);

   const handleFormSubmit = async (data: UserFormData) => {
        setIsSubmitting(true);
        try {
            // If editing, don't send password if it wasn't changed (or handle password update separately)
            const dataToSend = mode === 'edit' && !data.password ? { ...data, password: undefined } : data;
            await onSubmit(dataToSend as UserFormData); // Adjust type if password becomes optional for edit
        } catch (error) {
             console.error("Error during user form submission:", error);
             // Error should be handled in the parent component's onSubmit callback
        } finally {
             setIsSubmitting(false);
        }
    };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
        {/* User Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Jane Doe" {...field} disabled={isSubmitting}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* User Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="agent@kpiquest.com" {...field} disabled={isSubmitting || mode === 'edit'} />
                 {/* Optionally disable email editing */}
              </FormControl>
               <FormMessage />
            </FormItem>
          )}
        />

         {/* User Role Selection */}
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
               <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                    <SelectItem value="" disabled>Select a role</SelectItem>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {/* Simple capitalization for display */}
                        {role.charAt(0).toUpperCase() + role.slice(1).replace('Manager', ' Manager').replace('Leader', ' Leader')}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />


         {/* User Password (Required for Add mode) */}
         {/* Conditionally render or adjust requirement based on mode */}
         {/* {mode === 'add' && ( */}
             <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{mode === 'add' ? 'Password' : 'New Password (Optional)'}</FormLabel>
                    <FormControl>
                         <PasswordInput placeholder="Min. 6 characters" {...field} disabled={isSubmitting}/>
                    </FormControl>
                    {mode === 'edit' && <p className="text-xs text-muted-foreground">Leave blank to keep current password.</p>}
                    <FormMessage />
                    </FormItem>
                )}
            />
         {/* )} */}


          <DialogFooter>
             <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 {isSubmitting ? 'Saving...' : (mode === 'add' ? 'Create User' : 'Update User')}
              </Button>
          </DialogFooter>
      </form>
    </Form>
  );
}
