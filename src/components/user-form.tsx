
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PasswordInput } from './ui/password-input';
import { Loader2, Info } from 'lucide-react';
import type { AppUser } from '@/services/user';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Define available user roles
export const USER_ROLES = ['admin', 'podManager', 'teamLeader', 'agent'] as const;
export type UserRole = typeof USER_ROLES[number];

// Helper function for display formatting
const formatRoleForDisplay = (role: UserRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1).replace('Manager', ' Manager').replace('Leader', ' Leader');
};

// Define the validation schema using Zod
const userFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }).max(50, { message: 'Name must be 50 characters or less.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  roles: z.array(z.enum(USER_ROLES)).min(1, { message: 'Please select at least one role.' }),
  password: z.string().optional(),
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

    // Dynamic schema for validation based on mode
    const dynamicSchema = mode === 'add'
        ? userFormSchema.extend({
            password: z.string().min(6, { message: 'Password is required and must be at least 6 characters.' }),
          })
        : userFormSchema.extend({
            password: z.string().optional().refine(val => !val || val.length >= 6, {
                message: 'New password must be at least 6 characters.',
            }),
        });

    const form = useForm<z.infer<typeof dynamicSchema>>({
        resolver: zodResolver(dynamicSchema),
        defaultValues: {
            name: initialData?.name || '',
            email: initialData?.email || '',
            roles: initialData?.roles || [],
            password: '',
        },
        mode: 'onChange',
    });

  // Reset form if initialData or mode changes
  useEffect(() => {
    if (initialData && mode === 'edit') {
      form.reset({
        name: initialData.name,
        email: initialData.email,
        roles: initialData.roles || [],
        password: '', // Always clear password for edit form
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
            const rolesToSend = Array.isArray(data.roles) ? data.roles : [];
            const dataToSend: UserFormData = {
                ...data,
                roles: rolesToSend,
                 // Only include password if it's provided
                 password: data.password || undefined,
            };
            await onSubmit(dataToSend);
        } catch (error) {
             console.error("Error during user form submission:", error);
        } finally {
             setIsSubmitting(false);
        }
    };

  return (
    <TooltipProvider>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid gap-6 py-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="agent@kpiquest.com" {...field} disabled={isSubmitting || mode === 'edit'} /></FormControl>{mode === 'edit' && <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>}<FormMessage /></FormItem>)} />
            <FormField control={form.control} name="roles" render={() => (<FormItem><FormLabel>Roles</FormLabel><div className="grid grid-cols-2 gap-4 pt-2">{USER_ROLES.map((role) => (<FormField key={role} control={form.control} name="roles" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(role)} onCheckedChange={(checked) => { const currentRoles = field.value || []; return checked ? field.onChange([...currentRoles, role]) : field.onChange(currentRoles.filter((value) => value !== role));}} disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">{formatRoleForDisplay(role)}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
            
            {/* Password field logic */}
            <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            {mode === 'add' ? 'Password' : 'Reset Password (Optional)'}
                            {mode === 'edit' && (
                                 <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="inline-block h-3 w-3 ml-1 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                        <p className="text-sm">
                                            For security, changing another user's password from the admin panel requires a backend service (like a Firebase Function), which is not implemented here. 
                                            The most reliable way to reset a password for a user who is locked out is to delete their user record and re-create it with a new temporary password.
                                        </p>
                                    </TooltipContent>
                                 </Tooltip>
                            )}
                        </FormLabel>
                        <FormControl>
                            <PasswordInput placeholder={mode === 'add' ? "Min. 6 characters" : "Enter new password"} {...field} disabled={isSubmitting}/>
                        </FormControl>
                         {mode === 'edit' && <FormDescription>Leave blank to keep the current password unchanged.</FormDescription>}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <DialogFooter className="pt-4">
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
    </TooltipProvider>
  );
}
