'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User as AuthUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db } from '@/lib/firebase';
import { DashboardLayout } from '@/components/dashboard-layout'; // For Admin/Manager view
import { AgentSidebarLayout } from '@/components/agent-sidebar-layout'; // For Agent view
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { Loader2 } from 'lucide-react'; // Import Loader2
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

  // Function to determine layout based on roles (Simplified, focusing on highest privilege first)
  const determineInitialLayout = useCallback((userRoles: UserRole[] | null): 'admin' | 'agent' | null => {
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

  // Effect to handle authentication, role fetching, and layout setting
  useEffect(() => {
    console.log("[ProfileLayout] Auth Effect Running");
    setIsLoading(true); // Start loading when checking auth
    setAuthChecked(false); // Reset auth check status

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      console.log("[ProfileLayout] Auth State Changed. Current User:", currentUser?.uid || 'None');
      if (currentUser) {
        const fetchedRoles = await fetchUserRoles(currentUser.uid);
        console.log("[ProfileLayout] Fetched roles:", fetchedRoles);
        setRoles(fetchedRoles || []); // Set roles state, ensure it's an array

        if (fetchedRoles === null || fetchedRoles.length === 0) {
          console.warn("[ProfileLayout] User has no roles or roles couldn't be fetched. Redirecting to login.");
          setLayoutType(null);
          router.push('/login');
        } else {
          const defaultLayout = determineInitialLayout(fetchedRoles);
          console.log("[ProfileLayout] Default layout based on roles:", defaultLayout);

          if (!defaultLayout) {
            console.error("[ProfileLayout] User has roles but no suitable default layout found. Redirecting.");
            setLayoutType(null);
            router.push('/login'); // Redirect if no suitable role found
            return; // Stop further processing
          }

          // Read preferred layout from localStorage
          let preferredLayout: 'admin' | 'agent' | null = null;
          try {
             preferredLayout = localStorage.getItem('preferredLayout') as 'admin' | 'agent';
          } catch (e) {
             console.warn("[ProfileLayout] Could not access localStorage.");
          }

          // Check if preferred layout is valid for the user's roles
          const canSeeAdmin = fetchedRoles.includes('admin') || fetchedRoles.includes('podManager') || fetchedRoles.includes('teamLeader');
          const canSeeAgent = fetchedRoles.includes('agent');
          let finalLayout = defaultLayout; // Start with role-based default

          if (preferredLayout === 'admin' && canSeeAdmin) {
             finalLayout = 'admin';
          } else if (preferredLayout === 'agent' && canSeeAgent) {
              finalLayout = 'agent';
          }
          // If preferredLayout is invalid for current roles, fall back to defaultLayout

          console.log(`[ProfileLayout] Setting layout to: ${finalLayout} (Preferred: ${preferredLayout}, Default: ${defaultLayout})`);
          setLayoutType(finalLayout);
           // Persist the *final* layout choice back to localStorage
           try {
               localStorage.setItem('preferredLayout', finalLayout);
           } catch (e) {
               console.warn("[ProfileLayout] Could not save preferredLayout to localStorage");
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
  }, [router, determineInitialLayout]); // Dependencies

  // Handler for layout change triggered by RoleSwitcher
  const handleLayoutChange = useCallback((newLayout: 'admin' | 'agent') => {
     // Ensure user has the role for the requested layout change
     const canChangeToAdmin = roles?.some(r => ['admin', 'podManager', 'teamLeader'].includes(r));
     const canChangeToAgent = roles?.includes('agent');

     if ((newLayout === 'admin' && !canChangeToAdmin) || (newLayout === 'agent' && !canChangeToAgent)) {
        console.warn(`[ProfileLayout] Attempted to switch to invalid layout '${newLayout}' for roles: ${roles?.join(', ')}`);
        return; // Do nothing if the change is invalid
     }

    setLayoutType(newLayout);
     try {
       localStorage.setItem('preferredLayout', newLayout);
       console.log(`[ProfileLayout] Layout changed to: ${newLayout} and persisted.`);
     } catch (e) {
       console.warn("[ProfileLayout] Could not save preferredLayout to localStorage");
     }
  }, [roles]); // Depend on roles to ensure validity check is current

  // Render loading state until auth is checked and layout determined
   if (isLoading || !authChecked) {
    console.log(`[ProfileLayout] Rendering Loading State: isLoading=${isLoading}, authChecked=${authChecked}`);
    return (
      <div className="flex h-screen items-center justify-center bg-background">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user is logged in but layout determination is still pending (should be quick)
  if (authChecked && firebaseAuth.currentUser && !layoutType) {
     console.log(`[ProfileLayout] Rendering Loading State: Layout determination pending.`);
      return (
          <div className="flex h-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }


  // Render based on layoutType
  if (layoutType === 'admin') {
    console.log("[ProfileLayout] Rendering DashboardLayout with props:", { roles: roles || [], currentLayout: layoutType, onLayoutChange: handleLayoutChange });
    return <DashboardLayout roles={roles || []} currentLayout={layoutType} onLayoutChange={handleLayoutChange}>{children}</DashboardLayout>;
  } else if (layoutType === 'agent') {
    console.log("[ProfileLayout] Rendering AgentSidebarLayout with props:", { roles: roles || [], currentLayout: layoutType, onLayoutChange: handleLayoutChange });
    return <AgentSidebarLayout roles={roles || []} currentLayout={layoutType} onLayoutChange={handleLayoutChange}>{children}</AgentSidebarLayout>;
  } else {
    // Fallback if layoutType is null (e.g., during redirect)
    console.log("[ProfileLayout] Rendering null because layoutType is null (likely redirecting).");
    return null;
  }
}
