"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn, generateInitials, generateRandomColor } from "@/lib/utils"; // Import helpers

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

// Extend AvatarFallbackProps to accept initials and color
interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  initials?: string; // Allow passing custom initials
  backgroundColor?: string; // Allow passing custom background color
  seed?: string; // Optional seed for consistent random color generation
}


const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, children, initials, backgroundColor, seed, style, ...props }, ref) => {
  // Generate initials from children if not provided explicitly
  const finalInitials = initials || (typeof children === 'string' ? generateInitials(children) : '?');
   // Generate random color if not provided, use seed for consistency if available
   // Note: True random color generation might cause hydration issues if not seeded consistently
   const finalBackgroundColor = backgroundColor || generateRandomColor();

  return (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full font-medium text-background", // Use text-background for contrast
      className
    )}
     style={{ backgroundColor: finalBackgroundColor, ...style }} // Apply background color
    {...props}
  >
    {finalInitials} {/* Display initials */}
  </AvatarPrimitive.Fallback>
)});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
