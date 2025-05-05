
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
        setRoles(fetchedRoles);
        if (fetchedRoles === null || fetchedRoles.length === 0) {
          console.warn("User has no roles or roles couldn't be fetched. Redirecting to login.");
          router.push('/login'); // Redirect if no roles found
        } else {
          // Determine initial layout based on fetched roles
          const initialLayout = determineInitialLayout(fetchedRoles);
          if (initialLayout) {
             // Check localStorage for persisted preference, otherwise use determined initial
            const persistedLayout = localStorage.getItem('preferredLayout') as 'admin' | 'agent';
             // Only apply persisted layout if it's valid for the user's roles
            if (persistedLayout && fetchedRoles.includes(persistedLayout === 'admin' ? 'admin' : 'agent')) { // Adjust condition based on role logic
                 setLayoutType(persistedLayout);
                 console.log(`Set layout from localStorage: ${persistedLayout}`);
             } else {
                 setLayoutType(initialLayout);
                 console.log(`Set initial layout: ${initialLayout}`);
             }

          } else {
            console.error("User logged in but has no recognized role for layout. Redirecting.");
            router.push('/login'); // Redirect if no suitable role found
          }
        }
      } else {
        // No user logged in, redirect to login
        router.push('/login');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router, determineInitialLayout]);

  const handleLayoutChange = useCallback((newLayout: 'admin' | 'agent') => {
    setLayoutType(newLayout);
    // Persist preference in localStorage
     localStorage.setItem('preferredLayout', newLayout);
     console.log(`Layout changed to: ${newLayout} and persisted.`);
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
  const layoutProps = {
    roles: roles || [], // Pass empty array if null
    currentLayout: layoutType,
    onLayoutChange: handleLayoutChange,
  };

  // Render layout based on the current state
  if (layoutType === 'admin') {
    console.log("Rendering DashboardLayout");
    return <DashboardLayout {...layoutProps}>{children}</DashboardLayout>;
  } else if (layoutType === 'agent') {
    console.log("Rendering AgentSidebarLayout");
    return <AgentSidebarLayout {...layoutProps}>{children}</AgentSidebarLayout>;
  } else {
    // Fallback or error state - should ideally be handled by redirects
    console.error("No valid layout type determined.");
    return <div>Error: Could not determine appropriate layout.</div>;
  }
}
