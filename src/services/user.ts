
import { collection, addDoc, getDocs, query, where, doc, setDoc, orderBy, onSnapshot, updateDoc } from 'firebase/firestore'; // Added updateDoc
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, app } from '@/lib/firebase'; // Import Firestore and Auth instances
import { USER_ROLES, UserRole } from '@/components/user-form'; // Import roles definitions

const usersCollectionRef = collection(db, 'users');
const auth = getAuth(app);

// Define the AppUser type for use across the application
export interface AppUser {
    id?: string; // Firestore document ID (Auth UID will be used)
    uid: string; // Firebase Auth UID
    name: string;
    email: string;
    roles: UserRole[]; // Changed from role: string to roles: UserRole[]
    avatarUrl?: string; // Optional field for user avatar (URL)
    avatarInitials?: string; // Optional custom initials for fallback
    avatarBgColor?: string; // Optional custom background color for fallback
    podId?: string | null; // Add podId field (can be null if not assigned)
    // Add other relevant user fields as needed: teamId, campaignId, etc.
}

/**
 * Creates a new user in Firebase Authentication and Firestore.
 * Uses the Auth UID as the Firestore document ID for easy linking.
 *
 * WARNING: This basic version creates users with email/password from the client-side.
 * This might not be ideal for production security. Consider using Firebase Functions
 * (callable functions) triggered from the client to handle user creation on the backend,
 * especially if you need more complex validation or logic.
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
            avatarUrl: '', // Initialize avatarUrl as empty string
            avatarInitials: '', // Initialize custom initials as empty
            avatarBgColor: '', // Initialize custom color as empty
            podId: null, // Initialize podId as null
            // Note: A default placeholder image URL like picsum is removed.
            // The Avatar component now handles generating initials and random colors
            // if avatarUrl, avatarInitials, or avatarBgColor are not provided.
        };
        // Use the Auth UID as the Firestore document ID
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, newUser);

        console.log(`User created successfully in Auth and Firestore: ${email} (Roles: ${roles.join(', ')}, UID: ${user.uid})`);

        // Return the full user object, using uid as the id
        return { id: user.uid, ...newUser };

    } catch (error: any) {
        console.error("Error creating user:", error);
        // Provide more specific error messages
        if (error.code === 'auth/email-already-in-use') {
            throw new Error(`The email address ${email} is already in use by another account.`);
        } else if (error.code === 'auth/weak-password') {
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
                uid: data.uid, // Ensure uid is included
                name: data.name || '',
                email: data.email || '',
                roles: Array.isArray(data.roles) ? data.roles : [], // Ensure roles is an array
                avatarUrl: data.avatarUrl || '', // Ensure defaults if missing
                avatarInitials: data.avatarInitials || '',
                avatarBgColor: data.avatarBgColor || '',
                podId: data.podId || null, // Ensure podId exists, default to null
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
    try {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            podId: podId // Set podId to the new value (string or null)
        });
        console.log(`Updated pod assignment for user ${userId} to pod ${podId}`);
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

