'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface AgentAvatarProps {
  agentName?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * AgentAvatar - Displays user avatar with initials fallback
 * - Shows user image if available
 * - Falls back to initials if no image
 * - Matches the app's design system
 */
export function AgentAvatar({ 
  agentName, 
  imageUrl, 
  size = 'md',
  className 
}: AgentAvatarProps) {
  // Generate initials from agent name
  const getInitials = (name: string | undefined): string => {
    if (!name || name.length === 0) return '?';
    
    // Handle "First Last" format
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    
    // Single name - just first letter
    return name.substring(0, 2).toUpperCase();
  };

  // Size classes
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const initials = getInitials(agentName);
  const displayName = agentName || 'Unknown Agent';

  // If image URL is available, show the image
  if (imageUrl) {
    return (
      <div className={cn(
        'relative rounded-full overflow-hidden flex-shrink-0',
        sizeClasses[size],
        className
      )}>
        <img
          src={imageUrl}
          alt={displayName}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // Fallback to initials with gradient background
  return (
    <div className={cn(
      'relative rounded-full flex items-center justify-center font-medium flex-shrink-0',
      sizeClasses[size],
      'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground',
      className
    )}>
      <span title={displayName}>{initials}</span>
    </div>
  );
}

/**
 * AgentAvatarGroup - Displays multiple avatars in a stack
 */
interface AgentAvatarGroupProps {
  agents: Array<{ name?: string; imageUrl?: string }>;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AgentAvatarGroup({ 
  agents, 
  max = 3, 
  size = 'sm',
  className 
}: AgentAvatarGroupProps) {
  const displayed = agents.slice(0, max);
  const remaining = agents.length - max;

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs -ml-2',
    md: 'h-8 w-8 text-sm -ml-2',
    lg: 'h-10 w-10 text-base -ml-3',
  };

  const overlapClass = sizeClasses[size];

  return (
    <div className={cn('flex items-center', className)}>
      {displayed.map((agent, index) => (
        <div 
          key={index} 
          className={cn(
            'relative rounded-full border-2 border-background',
            index > 0 && overlapClass
          )}
          style={{ zIndex: displayed.length - index }}
        >
          <AgentAvatar 
            agentName={agent.name} 
            imageUrl={agent.imageUrl}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div className={cn(
          'relative rounded-full flex items-center justify-center font-medium bg-muted text-muted-foreground border-2 border-background',
          sizeClasses[size],
          '-ml-2'
        )}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
