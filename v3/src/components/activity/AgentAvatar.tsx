'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';

interface AgentAvatarProps {
  agentName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Generate consistent background color based on name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];

  // Simple hash function for consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function AgentAvatar({ agentName, size = 'md', className = '' }: AgentAvatarProps) {
  const initials = generateInitials(agentName);
  const bgColor = getAvatarColor(agentName);

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarFallback className={bgColor}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
