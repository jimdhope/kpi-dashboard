
import { collection, addDoc, getDocs, query, where, doc, setDoc, orderBy, onSnapshot, updateDoc, getDoc } from 'firebase/firestore'; // Added getDoc
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'; // Added signInWithEmailAndPassword, signOut
import { db, app } from '@/lib/firebase'; // Import Firestore and Auth instances
import { USER_ROLES, UserRole } from '@/components/user-form'; // Import roles definitions
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase-config';


const usersCollectionRef = collection(db, 'users');
const auth = getAuth(app);

// Define the AppUser type for use across the application
export interface AppUser {
    id?: string; // Firestore document ID (Auth UID will be used)
    uid: string; // Firebase Auth UID
    name: string;
    email: string;
    roles: UserRole[]; // Changed from role: string to roles: UserRole[]
    avatarUrl?: string; // Optional field for user avatar (URL) - kept for potential future use but not displayed
    avatarInitials?: string; // Optional custom initials for fallback
    avatarBgColor?: string; // Optional custom background color for fallback
    podId?: string | null; // Add podId field (can be null if not assigned)
    // Add other relevant user fields as needed: teamId, campaignId, etc.
}

/**
 * Creates a new user in Firebase Authentication and Firestore.
 * If the user already exists in Auth but not Firestore, it repairs the record.
 *
 * @param name User's full name
 * @param email User's email address
 * @param password User's password (should be temporary and user prompted to change)
 * @param roles Array of user roles (e.g., ['admin', 'agent'])
 * @returns The created AppUser object (including Firestore ID which is the Auth UID)
 * @throws Error if creation fails (e.g., email already exists, weak password)
 */
export async function createUser(name: string, email: string, password: string, roles: UserRole[]): Promise<AppUser> {
    // Basic validation
    if (!name || !email || !password || !roles || roles.length === 0) {
        throw new Error("Missing required user information (name, email, password, roles).");
    }
     if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
    }
     // Basic role validation
    if (!roles.every(role => USER_ROLES.includes(role))) {
        throw new Error(`Invalid role specified. Valid roles are: ${USER_ROLES.join(', ')}.`);
    }


    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user) {
             throw new Error("Firebase Authentication did not return a user object.");
        }

        // 2. Create user document in Firestore
        const newUser: Omit<AppUser, 'id'> = {
            uid: user.uid,
            name: name,
            email: email, // Store email for easier display/querying
            roles: roles, // Save the array of roles
            avatarUrl: '', // Initialize avatarUrl as empty string (not used for display)
            avatarInitials: '', // Initialize custom initials as empty
            avatarBgColor: '', // Initialize custom color as empty
            podId: null, // Initialize podId as null
        };
        // Use the Auth UID as the Firestore document ID
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, newUser);

        console.log(`User created successfully in Auth and Firestore: ${email} (Roles: ${roles.join(', ')}, UID: ${user.uid})`);

        // Return the full user object, using uid as the id
        return { id: user.uid, ...newUser };

    } catch (error: any) {
        console.error("Initial error creating user:", error.code);
        
        // --- Orphaned User Recovery Logic ---
        if (error.code === 'auth/email-already-in-use') {
             console.log(`Email ${email} already exists in Auth. Attempting to recover orphaned user...`);
             const tempAppName = `temp-auth-app-${Date.now()}`;
             const tempApp = initializeApp(firebaseConfig, tempAppName);
             const tempAuth = getAuth(tempApp);

             try {
                // Try to sign in with the provided credentials to get the UID
                const userCredential = await signInWithEmailAndPassword(tempAuth, email, password);
                const existingUser = userCredential.user;
                const userDocRef = doc(db, 'users', existingUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    // This is an orphan. Create the Firestore doc to fix it.
                    console.log(`User ${email} is an orphan. Creating Firestore document...`);
                    const newUserDoc: Omit<AppUser, 'id'> = {
                        uid: existingUser.uid,
                        name: name,
                        email: email,
                        roles: roles,
                        avatarUrl: '',
                        avatarInitials: '',
                        avatarBgColor: '',
                        podId: null,
                    };
                    await setDoc(userDocRef, newUserDoc);
                    console.log(`Successfully created Firestore document for orphaned user ${email}.`);
                    return { id: existingUser.uid, ...newUserDoc };
                } else {
                    // User exists in both Auth and Firestore. This is a true duplicate.
                    throw new Error(`The email address ${email} is already in use by another account.`);
                }

             } catch (signInError: any) {
                 // This catch block handles errors from the temporary sign-in attempt.
                 console.error(`Error during orphan recovery for ${email}:`, signInError.code);
                 // If sign-in failed (e.g., wrong password for existing user), throw the original error.
                 throw new Error(`The email address ${email} is already in use. If you are trying to repair a user, ensure the password is correct.`);
             } finally {
                // Always clean up the temporary app instance
                await signOut(tempAuth);
                await deleteApp(tempApp);
                console.log(`Temporary app instance ${tempAppName} cleaned up.`);
             }
        }
        
        // Provide more specific error messages for other cases
        if (error.code === 'auth/weak-password') {
             throw new Error("The password provided is too weak.");
        } else if (error.code === 'auth/invalid-email') {
            throw new Error(`The email address ${email} is not valid.`);
        }
        // General error fallback
        throw new Error(`Failed to create user: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Fetches all users from Firestore using getDocs (single fetch).
 * Consider using onSnapshot if real-time updates are needed across the app.
 * @returns A promise that resolves to an array of AppUser objects.
 */
export async function getAllUsers(): Promise<AppUser[]> {
    try {
        const q = query(usersCollectionRef, orderBy('name')); // Order by name for consistency
        const userSnapshot = await getDocs(q);
        return userSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                uid: data.uid || doc.id, // Ensure uid is included, fallback to doc.id if needed
                name: data.name || '',
                email: data.email || '',
                roles: Array.isArray(data.roles) ? data.roles : [], // Ensure roles is an array
                avatarUrl: data.avatarUrl || '', // Ensure defaults if missing
                avatarInitials: data.avatarInitials || '',
                avatarBgColor: data.avatarBgColor || '',
                podId: data.podId === undefined ? null : data.podId, // Explicitly handle undefined
            } as AppUser;
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to retrieve users list.");
    }
}


/**
 * Updates the podId for a specific user.
 * @param userId The ID of the user to update (should be the Auth UID).
 * @param podId The ID of the pod to assign, or null to unassign.
 */
export async function updateUserPodAssignment(userId: string, podId: string | null): Promise<void> {
    if (!userId) {
        console.error("updateUserPodAssignment called with invalid userId:", userId);
        throw new Error("Invalid user ID provided.");
    }
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            podId: podId // Set podId to the new value (string or null)
        });
        console.log(`Updated pod assignment for user ${userId} to pod ${podId === null ? 'null' : podId}`);
    } catch (error) {
        console.error(`Error updating pod assignment for user ${userId}:`, error);
        throw new Error("Failed to update user's pod assignment.");
    }
}

export { USER_ROLES }; // Export USER_ROLES const
export type { UserRole }; // Export UserRole type


// Potential future functions:
// export async function getUserById(uid: string): Promise<AppUser | null> { ... }
// export async function updateUser(uid: string, data: Partial<AppUser>): Promise<void> { ... } // General update function
// export async function deleteUser(uid: string): Promise<void> {
//   // Requires deleting from Firestore AND Firebase Auth (potentially using Admin SDK)
// }
// export async function getUsersByRole(role: string): Promise<AppUser[]> { ... }
