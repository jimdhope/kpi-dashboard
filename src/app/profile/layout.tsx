
'use client';
import React, { useState, useEffect } from 'react';
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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (currentUser) {
        const fetchedRoles = await fetchUserRoles(currentUser.uid);
        setRoles(fetchedRoles);
         if (fetchedRoles === null || fetchedRoles.length === 0) {
            // Handle cases where roles couldn't be fetched or user has no roles
            console.warn("User has no roles or roles couldn't be fetched. Redirecting...");
             // Redirect to a default page or show an error message.
             // For now, redirecting to login as a fallback.
             router.push('/login');
        }
      } else {
        // No user logged in, redirect to login
        router.push('/login');
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
     // Show a full-page skeleton or loading indicator
     return (
        <div className="flex h-screen items-center justify-center">
             <Skeleton className="h-32 w-32 rounded-full" />
         </div>
     );
  }

  if (!roles) {
      // This case should ideally be handled by the redirect, but as a fallback:
      return <div>Error: Could not load user profile or roles. Please try logging in again.</div>;
   }


  // Determine layout based on fetched roles
  // Give priority to admin/manager/leader roles
  const isAdminOrManager = roles.includes('admin') || roles.includes('podManager') || roles.includes('teamLeader');
  const isAgent = roles.includes('agent');

  if (isAdminOrManager) {
    console.log("Rendering DashboardLayout for admin/manager/leader");
    return <DashboardLayout>{children}</DashboardLayout>;
  } else if (isAgent) {
     console.log("Rendering AgentSidebarLayout for agent");
    return <AgentSidebarLayout>{children}</AgentSidebarLayout>;
  } else {
    // This case should also be handled by the initial check/redirect
    console.error("User logged in but has no recognized role for layout.");
    // Redirect or show error - redirecting to login as fallback
    // router.push('/login'); // Avoid infinite loop if roles become null somehow
     return <div>Error: User role not recognized.</div>;
  }
}
