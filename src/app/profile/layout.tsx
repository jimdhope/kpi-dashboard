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

// Helper function to fetch user roles from Firestore
async function fetchUserRoles(uid: string): Promise<UserRole[] | null> {
  console.log(`[fetchUserRoles] Fetching roles for UID: ${uid}`); // Log UID
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data() as AppUser;
      const fetchedRoles = userData.roles || [];
      console.log(`[fetchUserRoles] Roles found for ${uid}:`, fetchedRoles); // Log fetched roles
      return fetchedRoles; // Return roles array or empty array
    } else {
      console.warn(`[fetchUserRoles] Firestore document for user ${uid} not found.`);
      return null; // Indicate profile not found
    }
  } catch (error) {
    console.error("[fetchUserRoles] Error fetching user roles:", error);
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
  const determineInitialLayout = useCallback((userRoles: UserRole[] | null): 'admin' | 'agent' | null => {
      console.log("[determineInitialLayout] Determining layout for roles:", userRoles);
      if (!userRoles || userRoles.length === 0) {
        console.log("[determineInitialLayout] No roles, returning null.");
        return null; // No roles, no specific layout
      }
      // Prioritize admin/manager/leader view
      if (userRoles.includes('admin') || userRoles.includes('podManager') || userRoles.includes('teamLeader')) {
         console.log("[determineInitialLayout] Found admin/manager/leader role, returning 'admin'.");
        return 'admin';
      } else if (userRoles.includes('agent')) {
         console.log("[determineInitialLayout] Found agent role, returning 'agent'.");
        return 'agent';
      }
       console.log("[determineInitialLayout] No suitable role found, returning null.");
      return null; // No recognized role for layout
    }, []);

  // Effect to handle authentication, role fetching, and layout setting
  useEffect(() => {
    console.log("[ProfileLayout] Auth Effect Running");
    setIsLoading(true); // Start loading when checking auth
    setAuthChecked(false); // Reset auth check status
    setRoles(null); // Reset roles on auth change
    setLayoutType(null); // Reset layout type on auth change

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      console.log("[ProfileLayout] Auth State Changed. Current User:", currentUser?.uid || 'None');
      if (currentUser) {
        const fetchedRoles = await fetchUserRoles(currentUser.uid);
        console.log("[ProfileLayout] Setting roles state to:", fetchedRoles);
        // Ensure roles is always an array, even if null was fetched
        const rolesToSet = Array.isArray(fetchedRoles) ? fetchedRoles : [];
        setRoles(rolesToSet);

        if (fetchedRoles === null || rolesToSet.length === 0) {
          console.warn("[ProfileLayout] User has no roles or roles couldn't be fetched. Redirecting to login.");
          setLayoutType(null);
           setIsLoading(false); // Stop loading before redirect
           setAuthChecked(true);
          router.push('/login');
          return; // Important to return here
        }

        const defaultLayout = determineInitialLayout(rolesToSet);
        console.log("[ProfileLayout] Default layout determined:", defaultLayout);

        if (!defaultLayout) {
          console.error("[ProfileLayout] User has roles but no suitable default layout found. Redirecting.");
          setLayoutType(null);
           setIsLoading(false); // Stop loading before redirect
           setAuthChecked(true);
          router.push('/login'); // Redirect if no suitable role found
          return; // Stop further processing
        }
        setLayoutType(defaultLayout); // Set the layout based solely on roles

      } else {
        // No user logged in
        console.log("[ProfileLayout] No user logged in, redirecting to login.");
        setRoles(null); // Clear roles
        setLayoutType(null); // Clear layoutType
         setIsLoading(false); // Stop loading before redirect
         setAuthChecked(true);
        router.push('/login');
        return; // Important to return here
      }
      console.log("[ProfileLayout] Finished processing auth state change. Setting isLoading=false, authChecked=true.");
      setIsLoading(false); // Stop loading after processing auth state
      setAuthChecked(true); // Mark auth as checked
    });

    return () => {
        console.log("[ProfileLayout] Cleaning up Auth Effect");
        unsubscribe();
    }
  }, [router, determineInitialLayout]); // Dependencies


  // Combine roles and layoutType into props object *after* state updates
  // Removed props for role switcher
  console.log("[ProfileLayout] Preparing to render layout...");

  // Render loading state until auth is checked and layout determined
   if (isLoading || !authChecked) {
    console.log(`[ProfileLayout] Rendering Loading State: isLoading=${isLoading}, authChecked=${authChecked}`);
    return (
      <div className="flex h-screen items-center justify-center bg-background">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user is logged in but layout determination is still pending
   if (authChecked && firebaseAuth.currentUser && !layoutType) {
     console.log(`[ProfileLayout] Rendering Loading State: Layout determination pending. Roles state:`, roles);
      // Show loading state only if roles are still null (being fetched/processed)
      if(roles === null) {
          return (
              <div className="flex h-screen items-center justify-center bg-background">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
          );
      }
      // If roles are set but layout is still null, something went wrong (likely redirecting)
      console.log("[ProfileLayout] Rendering null because layout determination failed or redirecting.");
      return null;
  }


  // Render based on layoutType
  if (layoutType === 'admin') {
    console.log("[ProfileLayout] Rendering DashboardLayout...");
    return <DashboardLayout>{children}</DashboardLayout>;
  } else if (layoutType === 'agent') {
    console.log("[ProfileLayout] Rendering AgentSidebarLayout...");
    return <AgentSidebarLayout>{children}</AgentSidebarLayout>;
  } else {
    // Fallback if layoutType is null (e.g., during redirect or if no suitable layout found)
    console.log("[ProfileLayout] Rendering null because layoutType is null (likely redirecting or no suitable role).");
    return null;
  }
}
