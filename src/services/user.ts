
import { collection, addDoc, getDocs, query, where, doc, setDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, app } from '@/lib/firebase'; // Import Firestore and Auth instances

const usersCollectionRef = collection(db, 'users');
const auth = getAuth(app);

// Define the AppUser type for use across the application
export interface AppUser {
    id?: string; // Firestore document ID (Auth UID will be used)
    uid: string; // Firebase Auth UID
    name: string;
    email: string;
    role: string; // e.g., 'admin', 'podManager', 'teamLeader', 'agent'
    avatarUrl?: string; // Optional field for user avatar
    // Add other relevant user fields as needed: podId, teamId, campaignId, etc.
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
 * @param role User's role ('admin', 'podManager', 'teamLeader', 'agent')
 * @returns The created AppUser object (including Firestore ID which is the Auth UID)
 * @throws Error if creation fails (e.g., email already exists, weak password)
 */
export async function createUser(name: string, email: string, password: string, role: string): Promise<AppUser> {
    // Basic validation (consider more robust validation)
    if (!name || !email || !password || !role) {
        throw new Error("Missing required user information (name, email, password, role).");
    }
     if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
    }
     // Basic role validation (adjust roles as needed)
    const validRoles = ['admin', 'podManager', 'teamLeader', 'agent'];
    if (!validRoles.includes(role)) {
        throw new Error(`Invalid role specified: ${role}. Valid roles are: ${validRoles.join(', ')}.`);
    }


    try {
        // 1. Create user in Firebase Authentication
        // IMPORTANT: This happens client-side in this implementation.
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
            role: role,
            avatarUrl: `https://picsum.photos/seed/${user.uid}/40`, // Default avatar placeholder
            // Initialize other fields as needed (e.g., podId: null)
        };
        // Use the Auth UID as the Firestore document ID
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, newUser);

        console.log(`User created successfully in Auth and Firestore: ${email} (Role: ${role}, UID: ${user.uid})`);

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
        return userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
    } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to retrieve users list.");
    }
}

// Potential future functions:
// export async function getUserById(uid: string): Promise<AppUser | null> { ... }
// export async function updateUser(uid: string, data: Partial<AppUser>): Promise<void> { ... }
// export async function deleteUser(uid: string): Promise<void> {
//   // Requires deleting from Firestore AND Firebase Auth (potentially using Admin SDK)
// }
// export async function getUsersByRole(role: string): Promise<AppUser[]> { ... }
