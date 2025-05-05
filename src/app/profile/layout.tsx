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

// Helper function to fetch user roles from Firestore (remains the same)
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
  const [layoutType, setLayoutType] = useState<'admin' | 'agent' | null>(null); // State for current layout
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [authChecked, setAuthChecked] = useState(false); // Track initial auth check
  const router = useRouter();

  // Function to determine layout based on roles
  const determineLayout = useCallback((userRoles: UserRole[] | null): 'admin' | 'agent' | null => {
    if (!userRoles || userRoles.length === 0) {
      return null; // No roles, no specific layout
    }
    // Prioritize admin/manager/leader view
    if (userRoles.includes('admin') || userRoles.includes('podManager') || userRoles.includes('teamLeader')) {
      return 'admin';
    } else if (userRoles.includes('agent')) {
      return 'agent';
    }
    return null; // No recognized role for layout
  }, []);

  // Effect to handle authentication and role fetching
  useEffect(() => {
    console.log("[ProfileLayout] Auth Effect Running");
    setIsLoading(true); // Start loading when checking auth
    setAuthChecked(false); // Reset auth check status

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      console.log("[ProfileLayout] Auth State Changed. Current User:", currentUser?.uid || 'None');
      if (currentUser) {
        const fetchedRoles = await fetchUserRoles(currentUser.uid);
        console.log("[ProfileLayout] Fetched roles:", fetchedRoles);
        setRoles(fetchedRoles); // Set roles state

        if (fetchedRoles === null || fetchedRoles.length === 0) {
          console.warn("[ProfileLayout] User has no roles or roles couldn't be fetched. Redirecting to login.");
          setRoles([]); // Set to empty array if null
          setLayoutType(null);
          router.push('/login');
        } else {
          const determinedLayout = determineLayout(fetchedRoles);
          console.log("[ProfileLayout] Determined layout:", determinedLayout);
          if (determinedLayout) {
             // Logic to check/set preferred layout from localStorage remains, but simplified setting
             let finalLayout = determinedLayout; // Default to determined layout
             try {
                const preferredLayout = localStorage.getItem('preferredLayout') as 'admin' | 'agent';
                const requiredRoleForPersisted = preferredLayout === 'admin' ? ['admin', 'podManager', 'teamLeader'] : ['agent'];
                const hasRequiredRole = fetchedRoles.some(role => requiredRoleForPersisted.includes(role));

                if (preferredLayout && hasRequiredRole) {
                    finalLayout = preferredLayout;
                    console.log(`[ProfileLayout] Setting layout from localStorage: ${finalLayout}`);
                } else {
                    localStorage.setItem('preferredLayout', finalLayout); // Persist the determined layout
                    console.log(`[ProfileLayout] Setting determined layout: ${finalLayout}`);
                }
             } catch (e) {
                 console.warn("[ProfileLayout] Could not access/save preferredLayout in localStorage");
                 // Use determinedLayout if localStorage fails
             }
             setLayoutType(finalLayout);
          } else {
            console.error("[ProfileLayout] User has roles but no suitable layout found. Redirecting.");
            setLayoutType(null);
            router.push('/login'); // Redirect if no suitable role found
          }
        }
      } else {
        // No user logged in
        console.log("[ProfileLayout] No user logged in, redirecting to login.");
        setRoles(null); // Clear roles
        setLayoutType(null); // Clear layoutType
        router.push('/login');
      }
      setIsLoading(false); // Stop loading after processing auth state
      setAuthChecked(true); // Mark auth as checked
    });

    return () => {
        console.log("[ProfileLayout] Cleaning up Auth Effect");
        unsubscribe();
    }
  }, [router, determineLayout]); // Dependencies

  // Handler for layout change (remains the same)
  const handleLayoutChange = useCallback((newLayout: 'admin' | 'agent') => {
    setLayoutType(newLayout);
     try {
       localStorage.setItem('preferredLayout', newLayout);
       console.log(`[ProfileLayout] Layout changed to: ${newLayout} and persisted.`);
     } catch (e) {
       console.warn("[ProfileLayout] Could not save preferredLayout to localStorage");
     }
  }, []);

  // Render loading state until auth is checked and layout determined
  if (isLoading || !authChecked || (authChecked && !layoutType && firebaseAuth.currentUser)) { // Show loading if logged in but layout not yet set
    console.log(`[ProfileLayout] Rendering Loading State: isLoading=${isLoading}, authChecked=${authChecked}, layoutType=${layoutType}, currentUser=${!!firebaseAuth.currentUser}`);
    return (
      <div className="flex h-screen items-center justify-center bg-background">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Ensure we have a valid layout before rendering
  if (!layoutType) {
     console.log("[ProfileLayout] Rendering null because no valid layoutType determined (likely redirecting).");
     // This should ideally not be reached if redirects work correctly, but acts as a fallback.
     // A redirect is likely happening, so rendering nothing prevents errors.
     return null;
  }


  // Prepare props only when layout is determined
  const layoutProps = {
    roles: roles || [], // Pass roles (guaranteed to be an array or empty)
    currentLayout: layoutType, // Pass the determined layout type
    onLayoutChange: handleLayoutChange,
  };

  console.log("[ProfileLayout] Rendering Layout:", layoutType, "with props:", layoutProps);

  // Render the appropriate layout based on the state
  if (layoutType === 'admin') {
    return <DashboardLayout {...layoutProps}>{children}</DashboardLayout>;
  } else if (layoutType === 'agent') {
    return <AgentSidebarLayout {...layoutProps}>{children}</AgentSidebarLayout>;
  } else {
    // Should not happen if logic above is correct
    console.error("[ProfileLayout] Fallback: No valid layout type. This indicates an issue.");
    return <div>Error: Invalid layout state.</div>;
  }
}
