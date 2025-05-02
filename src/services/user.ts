
import { collection, addDoc, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, app } from '@/lib/firebase'; // Import Firestore and Auth instances

const usersCollectionRef = collection(db, 'users');
const auth = getAuth(app);

// Simplified User type for this service
export interface AppUser {
    id?: string; // Firestore document ID (optional for creation)
    uid: string; // Firebase Auth UID
    name: string;
    email: string;
    role: string; // e.g., 'admin', 'podManager', 'teamLeader', 'agent'
    // Add other relevant user fields: podId, teamId, etc.
}

/**
 * Creates a new user in Firebase Authentication and Firestore.
 * WARNING: This basic version creates users with email/password.
 * Consider security implications and potentially use Admin SDK for backend creation.
 * This function is primarily for seeding/testing in the admin panel if enabled.
 * @param name User's full name
 * @param email User's email address
 * @param password User's password (consider generating secure temporary ones)
 * @param role User's role
 * @returns The created AppUser object (including Firestore ID)
 */
export async function createUser(name: string, email: string, password: string, role: string): Promise<AppUser> {
    try {
        // 1. Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Create user document in Firestore
        const newUser: Omit<AppUser, 'id'> = {
            uid: user.uid,
            name: name,
            email: email,
            role: role,
        };
        // Use the Auth UID as the Firestore document ID for easy linking
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, newUser);

        console.log(`User created successfully: ${email} (Role: ${role})`);

        return { id: user.uid, ...newUser };

    } catch (error: any) {
        console.error("Error creating user:", error);
        // Handle specific errors (e.g., email-already-in-use)
        if (error.code === 'auth/email-already-in-use') {
            throw new Error(`Email address ${email} is already registered.`);
        }
        throw new Error(`Failed to create user: ${error.message}`);
    }
}

/**
 * Fetches all users from Firestore.
 * Consider adding pagination and filtering for large user bases.
 * @returns A promise that resolves to an array of AppUser objects.
 */
export async function getAllUsers(): Promise<AppUser[]> {
    try {
        const userSnapshot = await getDocs(usersCollectionRef);
        return userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
    } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to retrieve users.");
    }
}

// Add more functions as needed:
// - getUserById(id: string)
// - updateUser(id: string, data: Partial<AppUser>)
// - deleteUser(id: string) // Requires careful handling of Auth and Firestore deletion
// - getUsersByRole(role: string)
