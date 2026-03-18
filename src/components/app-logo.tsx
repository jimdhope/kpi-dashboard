// src/components/app-logo.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface AppLogoProps extends React.SVGProps<SVGSVGElement> {}

export function AppLogo({ className, ...props }: AppLogoProps) {
  return (
    <svg
      width="24" // Default size, can be overridden by className
      height="24" // Default size, can be overridden by className
      viewBox="0 0 1000 1000" // Set the viewBox from the provided SVG
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)} // Apply className for customization
      {...props} // Spread other SVG props
    >
      {/* Use currentColor for fill and stroke to inherit color */}
      <path id="Circle" fill="currentColor" fillRule="evenodd" stroke="none" d="M 848 484 C 848 300.641479 699.358521 152 516 152 C 516 287 516 300.641479 516 484 C 740 484 645 484 848 484 Z"/>
      <path id="path1" fill="currentColor" fillRule="evenodd" stroke="none" d="M 848 831.5 C 848 773.791748 807.7677 725.480286 753.821594 713.084167 C 745.039734 711.066162 754.785217 727.324463 689 769 C 637.416626 801.678589 640.679871 794.47052 606.291443 813.721436 C 601.173706 816.586365 605 825.460754 605 831.5 C 605 898.6026 659.3974 953 726.5 953 C 793.6026 953 848 898.6026 848 831.5 Z"/>
      <path id="path2" fill="none" stroke="currentColor" strokeWidth="15" d="M 830 500.5 C 735 500.5 581 502 500 502 C 500 440 499.5 296 499.5 170 C 316.96991 170 169 317.96991 169 500.5 C 169 683.03009 316.96991 831 499.5 831 C 682.03009 831 830 683.03009 830 500.5 Z"/>
    </svg>
  );
}
