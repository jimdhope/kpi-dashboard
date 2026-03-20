'use client';

import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AutoSaveStatusState = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveStatusProps {
  /** Current status of the auto-save operation */
  status: AutoSaveStatusState;
  /** Custom class name */
  className?: string;
  /** Time in ms to show "Saved" status before fading out (default: 2000) */
  fadeOutDelay?: number;
}

/**
 * AutoSaveStatus - A reusable component to show auto-save status
 * 
 * Displays:
 * - "Saving..." with spinner (when status is 'saving')
 * - "Saved ✓" in green with fade-out animation (when status is 'saved')
 * - Nothing when status is 'idle'
 * - "Error saving" in red (when status is 'error')
 * 
 * @example
 * ```tsx
 * const [saveStatus, setSaveStatus] = useState<AutoSaveStatusState>('idle');
 * 
 * // In your save handler:
 * setSaveStatus('saving');
 * await save();
 * setSaveStatus('saved');
 * 
 * // In your JSX:
 * <AutoSaveStatus status={saveStatus} />
 * ```
 */
export function AutoSaveStatus({
  status,
  className,
  fadeOutDelay = 2000,
}: AutoSaveStatusProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => {
        setShowSaved(false);
      }, fadeOutDelay);
      return () => clearTimeout(timer);
    }
  }, [status, fadeOutDelay]);

  if (status === 'idle' && !showSaved) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-sm transition-all duration-300",
        status === 'saving' && "text-muted-foreground",
        (status === 'saved' || showSaved) && "text-green-600",
        status === 'error' && "text-destructive",
        (status === 'saved' || showSaved) && showSaved && "opacity-0",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {status === 'saving' && (
        <>
          <span className="animate-pulse">Saving...</span>
        </>
      )}
      {(status === 'saved' || showSaved) && (
        <span
          className={cn(
            "flex items-center gap-1 transition-opacity duration-500",
            showSaved && status !== 'saving' && "opacity-0"
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
      {status === 'error' && (
        <span className="text-destructive">Error saving</span>
      )}
    </div>
  );
}

/**
 * Hook for managing auto-save status with automatic state transitions
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { status, startSave, completeSave, failSave } = useAutoSaveStatus();
 *   
 *   const handleChange = async (value: string) => {
 *     startSave();
 *     try {
 *       await save(value);
 *       completeSave();
 *     } catch {
 *       failSave();
 *     }
 *   };
 *   
 *   return (
 *     <>
 *       <Input onChange={handleChange} />
 *       <AutoSaveStatus status={status} />
 *     </>
 *   );
 * }
 * ```
 */
export function useAutoSaveStatus(fadeOutDelay = 2000) {
  const [status, setStatus] = useState<AutoSaveStatusState>('idle');

  const startSave = () => {
    setStatus('saving');
  };

  const completeSave = () => {
    setStatus('saved');
    // Reset to idle after fade out
    setTimeout(() => {
      setStatus('idle');
    }, fadeOutDelay);
  };

  const failSave = () => {
    setStatus('error');
    // Reset to idle after showing error
    setTimeout(() => {
      setStatus('idle');
    }, 3000);
  };

  const reset = () => {
    setStatus('idle');
  };

  return {
    status,
    startSave,
    completeSave,
    failSave,
    reset,
    isIdle: status === 'idle',
    isSaving: status === 'saving',
    isSaved: status === 'saved',
    hasError: status === 'error',
  };
}
