
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
import { StaticBackground } from '@/components/static-background'; // Import the new background

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
  const [roles, setRoles] = useState<UserRole[]>([]); // Initialize with empty array
  const [layoutType, setLayoutType] = useState<'admin' | 'agent' | null>(null); // State for current layout
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [authChecked, setAuthChecked] = useState(false); // Track initial auth check
  const router = useRouter();

  // Function to determine initial layout based on roles
  const determineInitialLayout = useCallback((userRoles: UserRole[]): 'admin' | 'agent' | null => {
      console.log("[determineInitialLayout] Determining layout for roles:", userRoles);
      if (userRoles.length === 0) {
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

  // Function to handle layout change from RoleSwitcher
  const handleLayoutChange = useCallback((newLayout: 'admin' | 'agent') => {
    console.log(`[ProfileLayout] handleLayoutChange called with: ${newLayout}`);
    setLayoutType(newLayout);
     // Optional: Redirect if necessary, though changing layout might be enough
     if (newLayout === 'admin') {
        router.push('/admin'); // Ensure user is on the admin route
     } else {
        router.push('/agent'); // Ensure user is on the agent route
     }
  }, [router]);


  // Effect to handle authentication, role fetching, and layout setting
  useEffect(() => {
    console.log("[ProfileLayout] Auth Effect Running");
    setIsLoading(true); // Start loading when checking auth
    setAuthChecked(false); // Reset auth check status
    setRoles([]); // Reset roles on auth change
    setLayoutType(null); // Reset layout type on auth change

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      console.log("[ProfileLayout] Auth State Changed. Current User:", currentUser?.uid || 'None');
      if (currentUser) {
        const fetchedRoles = await fetchUserRoles(currentUser.uid);
        const rolesToSet = Array.isArray(fetchedRoles) ? fetchedRoles : [];
        console.log("[ProfileLayout] Setting roles state to:", rolesToSet);
        setRoles(rolesToSet); // Set roles (even if empty)

        if (!fetchedRoles) { // Check if fetch returned null (error or profile not found)
          console.error("[ProfileLayout] Roles couldn't be fetched or user profile missing. Redirecting to login.");
          setLayoutType(null);
           setIsLoading(false); // Stop loading before redirect
           setAuthChecked(true);
          router.push('/login');
          return; // Important to return here
        }

        if (rolesToSet.length === 0) {
             console.warn("[ProfileLayout] User has no roles assigned. Redirecting to login.");
             setLayoutType(null);
             setIsLoading(false);
             setAuthChecked(true);
             router.push('/login'); // Or maybe a "pending assignment" page?
             return;
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
         // Determine initial layout based on roles
         const initialLayout = determineInitialLayout(rolesToSet);
         console.log("[ProfileLayout] Initial layout determined:", initialLayout);
         setLayoutType(initialLayout); // Set initial layout type

      } else {
        // No user logged in
        console.log("[ProfileLayout] No user logged in, redirecting to login.");
        setRoles([]); // Clear roles
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


  // Props object to pass down
  const layoutProps = {
    roles: roles, // Pass the fetched roles
    currentLayout: layoutType,
    onLayoutChange: handleLayoutChange,
  };
  console.log("[ProfileLayout] Preparing to render layout with props:", layoutProps);

  // Render loading state until auth is checked and layout determined
   if (isLoading || !authChecked || (firebaseAuth.currentUser && !layoutType && roles.length === 0)) { // Add roles check
    console.log(`[ProfileLayout] Rendering Loading State: isLoading=${isLoading}, authChecked=${authChecked}, layoutType=${layoutType}, rolesLength=${roles.length}`);
    return (
       <div className="relative min-h-screen">
         {/* Fixed Background Container */}
         <div className="fixed-background-container">
           <StaticBackground />
         </div>
         {/* Loading Indicator Centered */}
         <div className="absolute inset-0 flex items-center justify-center">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </div>
    );
  }


  // Render based on layoutType
   // Add the background and scrollable container structure here
   return (
    <div className="relative min-h-screen">
      {/* Fixed Background Container */}
      <div className="fixed-background-container">
        <StaticBackground />
      </div>
       {/* Scrollable Content Container */}
      <div className="scrollable-content-container">
        {layoutType === 'admin' && (
          <DashboardLayout {...layoutProps}>
            {children}
          </DashboardLayout>
        )}
        {layoutType === 'agent' && (
          <AgentSidebarLayout {...layoutProps}>
            {children}
          </AgentSidebarLayout>
        )}
         {/* Render null or a redirect/error component if layoutType is null */}
         {!layoutType && null}
      </div>
    </div>
   );
}
