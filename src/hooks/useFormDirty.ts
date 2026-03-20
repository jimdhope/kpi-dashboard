'use client';

import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';

interface UseFormDirtyOptions {
  /** Custom warning message to show in toast */
  warningMessage?: string;
  /** Whether to enable browser beforeunload warning (default: true) */
  enableBeforeUnload?: boolean;
}

/**
 * Hook to detect unsaved changes in a form and warn the user
 * before navigating away or closing the browser.
 * 
 * @example
 * ```tsx
 * function MyForm() {
 *   const form = useForm<MyFormData>();
 *   const { isDirty, warnIfDirty } = useFormDirty(form, {
 *     warningMessage: "You have unsaved changes.",
 *   });
 *   
 *   const handleNavigate = () => {
 *     if (warnIfDirty()) return; // Prevent navigation if dirty
 *     router.push('/other-page');
 *   };
 *   
 *   return <Form {...form}>...</Form>;
 * }
 * ```
 */
export function useFormDirty<T extends FieldValues>(
  form: UseFormReturn<T>,
  options: UseFormDirtyOptions = {}
) {
  const {
    warningMessage = "You have unsaved changes. Are you sure you want to leave?",
    enableBeforeUnload = true,
  } = options;

  const { toast } = useToast();
  const isDirtyRef = useRef(form.formState.isDirty);
  
  // Track dirty state
  const isDirty = form.formState.isDirty;

  // Sync ref for beforeunload handler
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Browser beforeunload warning
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && enableBeforeUnload) {
        e.preventDefault();
        e.returnValue = warningMessage;
        return warningMessage;
      }
    },
    [warningMessage, enableBeforeUnload]
  );

  useEffect(() => {
    if (enableBeforeUnload) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [handleBeforeUnload, enableBeforeUnload]);

  /**
   * Check if form is dirty and show warning toast.
   * Returns true if navigation should be blocked.
   */
  const warnIfDirty = useCallback(() => {
    if (isDirtyRef.current) {
      toast({
        title: "Unsaved Changes",
        description: warningMessage,
        variant: "destructive",
        duration: 5000,
      });
      return true;
    }
    return false;
  }, [toast, warningMessage]);

  /**
   * Reset the form dirty state without resetting values
   */
  const clearDirty = useCallback(() => {
    form.reset(form.getValues(), { keepValues: true });
  }, [form]);

  return {
    isDirty,
    warnIfDirty,
    clearDirty,
    /** Check if form has errors */
    hasErrors: Object.keys(form.formState.errors).length > 0,
    /** Check if form is currently submitting */
    isSubmitting: form.formState.isSubmitting,
  };
}

export type { UseFormDirtyOptions };
