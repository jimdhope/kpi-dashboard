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
   const [clientBackgroundColor, setClientBackgroundColor] = React.useState<string | null>(null);

   // Generate initials from children if not provided explicitly
   const finalInitials = initials || (typeof children === 'string' ? generateInitials(children) : '?');

   React.useEffect(() => {
     // Generate random color only on the client, after initial render
     if (!backgroundColor) {
       setClientBackgroundColor(generateRandomColor());
     }
   }, [backgroundColor]); // Rerun if explicitly provided background changes

   // Use explicitly provided color, or client-generated color, or default to null (CSS will handle)
   const finalBackgroundColor = backgroundColor || clientBackgroundColor;

  return (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full font-medium text-background", // Use text-background for contrast
      !finalBackgroundColor && "bg-muted", // Use muted background if no color is ready/provided yet
      className
    )}
     style={{
       ...style, // Spread original style first
       // Apply background color only if it's available (explicitly passed or generated client-side)
       ...(finalBackgroundColor ? { backgroundColor: finalBackgroundColor } : {}),
      }}
    {...props}
  >
    {finalInitials} {/* Display initials */}
  </AvatarPrimitive.Fallback>
)});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
