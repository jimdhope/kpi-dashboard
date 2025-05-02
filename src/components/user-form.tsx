
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Keep Label
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PasswordInput } from './ui/password-input';
import { Loader2 } from 'lucide-react';
import type { AppUser } from '@/services/user';

// Define available user roles (remains the same)
export const USER_ROLES = ['admin', 'podManager', 'teamLeader', 'agent'] as const;
export type UserRole = typeof USER_ROLES[number];

// Helper function for display formatting
const formatRoleForDisplay = (role: UserRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1).replace('Manager', ' Manager').replace('Leader', ' Leader');
};

// Define the validation schema using Zod
// roles is now an array of enums, required to have at least one role
const userFormSchemaBase = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }).max(50, { message: 'Name must be 50 characters or less.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  roles: z.array(z.enum(USER_ROLES)).min(1, { message: 'Please select at least one role.' }),
  password: z.string().optional(),
  // Add other user fields if needed
});

// Conditional validation for password based on mode
const userFormSchema = userFormSchemaBase.superRefine((data, ctx) => {
    if (data.password && data.password.length < 6) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password must be at least 6 characters.',
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

    // Adjust schema based on mode for password requirement
    const dynamicSchema = mode === 'add'
        ? userFormSchemaBase.extend({
            password: z.string().min(6, { message: 'Password is required and must be at least 6 characters.' }),
          })
        : userFormSchemaBase; // Password is optional for edit

    const form = useForm<UserFormData>({
        resolver: zodResolver(dynamicSchema),
        defaultValues: {
            name: initialData?.name || '',
            email: initialData?.email || '',
            roles: initialData?.roles || [], // Initialize roles as empty array or from initialData
            password: '', // Always clear password field initially
        },
        mode: 'onChange', // Validate on change
    });

  // Reset form if initialData or mode changes
  useEffect(() => {
    if (initialData && mode === 'edit') {
      form.reset({
        name: initialData.name,
        email: initialData.email,
        roles: initialData.roles || [],
        password: '', // Don't pre-fill password in edit mode
      });
    } else if (mode === 'add') {
        form.reset({
            name: '',
            email: '',
            roles: [],
            password: '',
        });
    }
  }, [initialData, mode, form]);

   const handleFormSubmit = async (data: UserFormData) => {
        setIsSubmitting(true);
        try {
            // Ensure roles is always an array
            const rolesToSend = Array.isArray(data.roles) ? data.roles : [];
            const dataToSend: UserFormData = {
                ...data,
                roles: rolesToSend,
                // Conditionally remove password if editing and it's empty
                ...(mode === 'edit' && !data.password && { password: undefined }),
            };
            await onSubmit(dataToSend);
        } catch (error) {
             console.error("Error during user form submission:", error);
        } finally {
             setIsSubmitting(false);
        }
    };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-6 py-4"> {/* Increased gap */}
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
              </FormControl>
               <FormMessage />
            </FormItem>
          )}
        />

         {/* User Roles Checkboxes */}
         <FormField
            control={form.control}
            name="roles"
            render={() => ( // No field needed directly, we manage checkboxes individually
                <FormItem>
                    <FormLabel>Roles</FormLabel>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        {USER_ROLES.map((role) => (
                            <FormField
                                key={role}
                                control={form.control}
                                name="roles"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(role)}
                                                onCheckedChange={(checked) => {
                                                    const currentRoles = field.value || [];
                                                    return checked
                                                        ? field.onChange([...currentRoles, role])
                                                        : field.onChange(currentRoles.filter((value) => value !== role));
                                                }}
                                                disabled={isSubmitting}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                            {formatRoleForDisplay(role)}
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                    <FormMessage /> {/* Show validation message for the roles array */}
                </FormItem>
            )}
            />


         {/* User Password */}
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


          <DialogFooter className="pt-4"> {/* Add padding top */}
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
