'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User as AuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db } from '@/lib/firebase';
import { DashboardLayout } from '@/components/dashboard-layout'; // For Admin/Manager view
import { AgentSidebarLayout } from '@/components/agent-sidebar-layout'; // For Agent view
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import type { AppUser, UserRole } from '@/services/user'; // Import types

// Helper function to fetch user roles from Firestore
async function fetchUserRoles(uid: string): Promise<UserRole[] | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data() as AppUser;
      return userData.roles || []; // Return roles array or empty array
    } else {
      console.warn(`Firestore document for user ${uid} not found.`);
      return null; // Indicate profile not found
    }
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return null; // Indicate error
  }
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [roles, setRoles] = useState<UserRole[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layoutType, setLayoutType] = useState<'admin' | 'agent' | null>(null); // State for current layout
  const router = useRouter();

  const determineInitialLayout = useCallback((userRoles: UserRole[]): 'admin' | 'agent' | null => {
    // Prioritize admin/manager/leader view
    if (userRoles.includes('admin') || userRoles.includes('podManager') || userRoles.includes('teamLeader')) {
      return 'admin';
    } else if (userRoles.includes('agent')) {
      return 'agent';
    }
    return null; // No recognized role for layout
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setIsLoading(true); // Start loading on auth change
      if (currentUser) {
        const fetchedRoles = await fetchUserRoles(currentUser.uid);
        console.log("[ProfileLayout] Fetched roles inside useEffect:", fetchedRoles); // Log fetched roles
        setRoles(fetchedRoles); // Set roles state

        if (fetchedRoles === null || fetchedRoles.length === 0) {
          console.warn("User has no roles or roles couldn't be fetched. Redirecting to login.");
          setLayoutType(null); // Ensure layoutType is null if no roles
          router.push('/login'); // Redirect if no roles found
          setIsLoading(false); // Stop loading after potential redirect
          return; // Exit early
        }

        // Determine initial layout based on fetched roles
        const initialLayout = determineInitialLayout(fetchedRoles);
        console.log("[ProfileLayout] Initial layout determined inside useEffect:", initialLayout); // Log initial layout

        if (initialLayout) {
          // Check localStorage for persisted preference, otherwise use determined initial
          let preferredLayout: 'admin' | 'agent' | null = null;
          try {
            preferredLayout = localStorage.getItem('preferredLayout') as 'admin' | 'agent';
          } catch (e) {
            console.warn("Could not access localStorage for preferredLayout");
          }

          // Only apply persisted layout if it's valid for the user's roles
          const requiredRoleForPersisted = preferredLayout === 'admin' ? ['admin', 'podManager', 'teamLeader'] : ['agent'];
          const hasRequiredRole = fetchedRoles.some(role => requiredRoleForPersisted.includes(role));

          let finalLayout: 'admin' | 'agent';
          if (preferredLayout && hasRequiredRole) {
            finalLayout = preferredLayout;
            console.log(`[ProfileLayout] Setting layout from localStorage: ${finalLayout}`);
          } else {
            finalLayout = initialLayout;
            try {
              localStorage.setItem('preferredLayout', finalLayout); // Persist the initial layout if preference is invalid or not set
            } catch (e) {
              console.warn("Could not save preferredLayout to localStorage");
            }
            console.log(`[ProfileLayout] Setting initial layout: ${finalLayout}`);
          }
          setLayoutType(finalLayout); // Set layoutType state
        } else {
          console.error("User logged in but has no recognized role for layout. Redirecting.");
          setLayoutType(null); // Ensure layoutType is null
          router.push('/login'); // Redirect if no suitable role found
        }

      } else {
        // No user logged in, redirect to login
        console.log("[ProfileLayout] No user logged in, redirecting.");
        setRoles(null); // Clear roles
        setLayoutType(null); // Clear layoutType
        router.push('/login');
      }
      setIsLoading(false); // Stop loading after processing
    });

    return () => unsubscribe();
  }, [router, determineInitialLayout]); // Add determineInitialLayout to dependencies

  const handleLayoutChange = useCallback((newLayout: 'admin' | 'agent') => {
    setLayoutType(newLayout);
    // Persist preference in localStorage
     try {
       localStorage.setItem('preferredLayout', newLayout);
     } catch (e) {
       console.warn("Could not save preferredLayout to localStorage");
     }
     console.log(`[ProfileLayout] Layout changed to: ${newLayout} and persisted.`);
     // Optional: Consider reloading the page or navigating to the root of the new layout area
     // Example: router.push(newLayout === 'admin' ? '/admin' : '/agent');
     // Be cautious with immediate redirects, ensure necessary state is handled.
  }, []);


  if (isLoading || !layoutType) {
     // Show a full-page skeleton or loading indicator
     return (
        <div className="flex h-screen items-center justify-center">
             {/* You can use a more sophisticated loader */}
             <Skeleton className="h-32 w-32 rounded-full" />
         </div>
     );
  }

  // Pass roles, current layout, and handler down to the chosen layout
  // Ensure roles defaults to an empty array if null or undefined
  const layoutProps = {
    roles: roles || [], // Ensure roles is always an array
    currentLayout: layoutType, // Pass the state variable
    onLayoutChange: handleLayoutChange,
  };

  console.log("[ProfileLayout] Rendering with layout type:", layoutType, "and props:", layoutProps); // Log before rendering

  // Render layout based on the current state
  // Spread the props correctly onto the child layout components
  if (layoutType === 'admin') {
    return <DashboardLayout {...layoutProps}>{children}</DashboardLayout>;
  } else if (layoutType === 'agent') {
    return <AgentSidebarLayout {...layoutProps}>{children}</AgentSidebarLayout>;
  } else {
    // Fallback or error state - should ideally be handled by redirects
    console.error("[ProfileLayout] No valid layout type determined. This should not happen.");
    return <div>Error: Could not determine appropriate layout. Check console logs.</div>;
  }
}
