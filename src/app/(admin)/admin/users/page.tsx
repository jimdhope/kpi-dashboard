
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  QuerySnapshot,
  DocumentData,
  doc,
  deleteDoc,
  setDoc, // Used for updating/setting with specific ID
  updateDoc,
} from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/lib/firebase'; // Import Firestore and Auth
import { deleteUser as deleteAuthUser, updatePassword, updateEmail } from 'firebase/auth'; // Firebase Auth functions
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar'; // Remove AvatarImage import
import { Edit, Trash2, PlusCircle, Loader2, ShieldCheck, UserCog, UserRound, Briefcase, Search, ShieldAlert, Info } from 'lucide-react'; // Added icons
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserForm, UserFormData, USER_ROLES, UserRole } from '@/components/user-form'; // Import UserForm and types
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AppUser, createUser, getAllUsers } from '@/services/user'; // Import user service functions and type
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { generateInitials } from '@/lib/utils'; // Import generateInitials
import { ScrollArea } from '@/components/ui/scroll-area';


const usersCollectionRef = collection(db, 'users');

// Role Icons Map
const roleIcons: Record<UserRole, React.ReactNode> = {
  admin: <UserCog className="h-4 w-4 text-red-600" title="Admin"/>,
  podManager: <Briefcase className="h-4 w-4 text-blue-600" title="Pod Manager"/>,
  teamLeader: <ShieldCheck className="h-4 w-4 text-green-600" title="Team Leader"/>,
  agent: <UserRound className="h-4 w-4 text-gray-500" title="Agent"/>,
};

// Simple role display formatter
const formatRoleForDisplay = (role: UserRole): string => {
     return role.charAt(0).toUpperCase() + role.slice(1).replace('Manager', ' Manager').replace('Leader', ' Leader');
}

// Format multiple roles for display
const formatRoles = (roles: UserRole[] = []): string => {
  if (!roles || roles.length === 0) return 'No Role Assigned';
  return roles.map(formatRoleForDisplay).join(', ');
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [searchTerm, setSearchTerm] = useState(''); // State for search term
  const { toast } = useToast();

  // Fetch Users with real-time updates
  useEffect(() => {
    setIsLoadingUsers(true);
    setError(null);

    const q = query(usersCollectionRef, orderBy('name'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const fetchedUsers: AppUser[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<AppUser, 'id'>;
        return {
          id: doc.id, // Firestore document ID (should match Auth UID)
          ...data,
          roles: data.roles || [], // Ensure roles is always an array
           // Ensure optional avatar fields exist or are initialized
           avatarUrl: data.avatarUrl || '',
           avatarInitials: data.avatarInitials || '',
           avatarBgColor: data.avatarBgColor || '',
        };
      });
      setUsers(fetchedUsers);
      setIsLoadingUsers(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching users with snapshot:", err);
      setError("Failed to fetch users. Please check your connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error Loading Users",
        description: "Could not load the user list.",
      });
      setIsLoadingUsers(false);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [toast]);

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return users;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      user.email.toLowerCase().includes(lowerCaseSearchTerm) ||
      user.roles?.some(role => role.toLowerCase().includes(lowerCaseSearchTerm)) // Search in roles too
    );
  }, [users, searchTerm]);

  const openAddDialog = () => {
    setSelectedUser(null);
    setDialogMode('add');
    setIsFormOpen(true);
  };

  const openEditDialog = (user: AppUser) => {
    setSelectedUser(user);
    setDialogMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (user: AppUser) => {
    setSelectedUser(user);
    setIsAlertOpen(true);
  };

   // Handle User Form Submission (Add & Edit)
   const handleFormSubmit = async (data: UserFormData) => {
     console.log("Submitting user form:", data, "Mode:", dialogMode);
     if (dialogMode === 'add') {
       try {
         // Use the createUser service function (handles Auth + Firestore)
         // Pass the roles array
         const newUser = await createUser(data.name, data.email, data.password!, data.roles);
         toast({
           title: "User Created",
           description: `User "${newUser.name}" (${formatRoles(newUser.roles)}) has been successfully created.`,
         });
         setIsFormOpen(false); // Close dialog on success
       } catch (err: any) {
         console.error("Error creating user:", err);
         toast({
           variant: "destructive",
           title: "Error Creating User",
           description: err.message || `Failed to create user "${data.name}". Check console.`,
         });
       }
     } else if (dialogMode === 'edit' && selectedUser) {
       // --- Edit User Logic ---
       try {
         const userDocRef = doc(db, 'users', selectedUser.id!); // Use ID (Auth UID)
         const updates: Partial<AppUser> = {
           name: data.name,
           roles: data.roles, // Update roles array
           // AvatarURL, avatarInitials, avatarBgColor might be updated here if added to the form later
         };

         // 1. Update Firestore Document (name, roles, etc.)
         await updateDoc(userDocRef, updates);

         // 2. Handle Email Update (Requires Backend/Admin SDK for reliability)
         if (data.email !== selectedUser.email) {
             console.warn(`Attempting to update email for ${selectedUser.email} to ${data.email}. This requires recent authentication or backend implementation.`);
             toast({
                 title: "Email Update Requires Backend",
                 description: `Firestore updated, but changing Auth email from ${selectedUser.email} to ${data.email} needs Admin SDK.`,
                 variant: "default",
                 duration: 10000,
             });
         }

         // 3. Handle Password Update (Requires Backend/Admin SDK for reliability)
         if (data.password) {
             console.warn(`Attempting to update password for ${selectedUser.email}. This requires backend implementation (Admin SDK) for password resets.`);
              toast({
                 title: "Password Update Requires Backend",
                 description: `Firestore updated, but Auth password changes require Admin SDK for resets.`,
                 variant: "default",
                 duration: 10000,
             });
         }

         toast({
           title: "User Updated",
           description: `User "${data.name}" has been successfully updated.`,
         });
         setIsFormOpen(false);
         setSelectedUser(null);
       } catch (err: any) {
         console.error("Error updating user:", err);
         toast({
           variant: "destructive",
           title: "Error Updating User",
           description: err.message || `Failed to update user "${selectedUser.name}".`,
         });
       }
     }
   };


   // Handle User Deletion
    const handleConfirmDelete = async () => {
        if (!selectedUser || !selectedUser.id) {
            toast({ variant: "destructive", title: "Error", description: "No user selected for deletion." });
            return;
        }

        const userIdToDelete = selectedUser.id;
        const userEmail = selectedUser.email;
        const userName = selectedUser.name;

        console.log(`Attempting to delete user: ${userEmail} (ID: ${userIdToDelete})`);

        try {
            // 1. Delete Firestore Document
            const userDocRef = doc(db, 'users', userIdToDelete);
            await deleteDoc(userDocRef);
            console.log(`Firestore document deleted for user: ${userEmail}`);

            // 2. Delete Firebase Auth User (Requires Backend/Admin SDK)
            console.warn(`ACTION REQUIRED: Deleting Auth user (${userEmail}) needs backend implementation using Firebase Admin SDK for security. Skipping client-side Auth deletion.`);
            toast({
                title: "Firestore Record Deleted",
                description: `User "${userName}" removed from database. Auth account deletion requires backend action.`,
                variant: "default",
                duration: 10000,
            });

        } catch (err: any) {
            console.error(`Error deleting Firestore document for user ${userEmail}:`, err);
            toast({
                variant: "destructive",
                title: "Error Deleting User Record",
                description: err.message || `Failed to delete Firestore data for "${userName}".`,
            });
        } finally {
             setIsAlertOpen(false);
             setSelectedUser(null);
        }
    };

    // Check if the logged-in user is the user being considered for deletion
    const isDeletingSelf = (userId: string | undefined): boolean => {
        const currentUser = firebaseAuth.currentUser;
        return !!currentUser && currentUser.uid === userId;
    }


  return (
    <TooltipProvider> {/* Added TooltipProvider */}
        <div className="space-y-6">
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className='flex-1'>
                    <CardTitle>Manage Users</CardTitle>
                    <CardDescription>View, add, edit, or delete user accounts and roles.</CardDescription>
                </div>
                <div className='flex gap-2 items-start flex-wrap'>
                    {/* Search Input */}
                    <div className="relative max-w-xs flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-full"
                        disabled={isLoadingUsers}
                    />
                    </div>
                    <DialogTrigger asChild>
                    <Button onClick={openAddDialog} disabled={isLoadingUsers}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                    </DialogTrigger>
                </div>
                </CardHeader>
                <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
                {error && !isLoadingUsers && (
                    <div className="mb-4 text-center text-destructive">{error}</div>
                )}
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background"> {/* Changed to bg-background */}
                    <TableRow>{/* Remove whitespace here */}
                        <TableHead className="w-[60px]">Avatar</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead className="text-right w-[150px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoadingUsers ? (
                        // Loading Skeleton Rows
                        Array.from({ length: 4 }).map((_, index) => (
                        <TableRow key={`loading-${index}`}>{/* Remove whitespace here */}
                            <TableCell>
                            <Skeleton className="h-10 w-10 rounded-full" />
                            </TableCell>
                            <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                            <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                            </div>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : filteredUsers.length === 0 && !error ? (
                        <TableRow>{/* Remove whitespace here */}
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            {searchTerm ? `No users found matching "${searchTerm}".` : "No users found. Add a user to get started."}
                        </TableCell>
                        </TableRow>
                    ) : (
                        filteredUsers.map((user) => (
                        <TableRow key={user.id}>{/* Remove whitespace here */}
                            <TableCell>
                             <Avatar className="h-10 w-10">
                                {/* Always use Fallback */}
                                <AvatarFallback
                                     initials={user.avatarInitials || generateInitials(user.name)}
                                     backgroundColor={user.avatarBgColor} // Pass potential custom color
                                 >
                                    {!user.avatarInitials && generateInitials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                            </TableCell>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                            {/* Display multiple roles */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1.5 text-muted-foreground cursor-default truncate max-w-[200px]">
                                        {/* Show first role icon or default */}
                                        {user.roles && user.roles.length > 0 && (roleIcons[user.roles[0]] || <UserRound className="h-4 w-4"/>)}
                                        {user.roles && user.roles.length === 0 && <ShieldAlert className="h-4 w-4 text-orange-500"/>}
                                        {formatRoles(user.roles)}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{formatRoles(user.roles)}</p>
                                </TooltipContent>
                            </Tooltip>

                            </TableCell>
                            <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                                <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(user)}
                                    aria-label={`Edit ${user.name}`}
                                    title={`Edit ${user.name}`}
                                    disabled={isLoadingUsers}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                                </DialogTrigger>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         {/* Wrap button in span to allow tooltip when disabled */}
                                        <span tabIndex={isDeletingSelf(user.id) ? 0 : -1}>
                                            <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                onClick={() => openDeleteAlert(user)}
                                                aria-label={`Delete ${user.name}`}
                                                title={`Delete ${user.name}`}
                                                disabled={isLoadingUsers || isDeletingSelf(user.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            </AlertDialogTrigger>
                                        </span>
                                    </TooltipTrigger>
                                     {isDeletingSelf(user.id) && (
                                        <TooltipContent>
                                            <p>Cannot delete yourself.</p>
                                        </TooltipContent>
                                     )}
                                </Tooltip>
                            </div>
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>

            {/* User Add/Edit Form Dialog */}
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                <DialogTitle>{dialogMode === 'add' ? 'Add New User' : 'Edit User'}</DialogTitle>
                <DialogDescription>
                    {dialogMode === 'add' ? 'Enter the details and select roles for the new user.' : `Make changes to ${selectedUser?.name || 'the user'}.`}
                     <Tooltip>
                        <TooltipTrigger asChild>
                             <Info className="inline-block h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-sm">Email and password changes require backend setup (Firebase Admin SDK) for security and reliability. Only Firestore data (name, roles) is updated directly here.</p>
                        </TooltipContent>
                     </Tooltip>
                </DialogDescription>
                </DialogHeader>
                <UserForm
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    initialData={selectedUser ?? undefined}
                    mode={dialogMode}
                    key={selectedUser?.id ?? 'add'}
                />
            </DialogContent>

            {/* Delete Confirmation Alert Dialog */}
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will delete the user <span className="font-semibold">"{selectedUser?.name}"</span> from the application database (Firestore).
                     <span className="font-bold text-destructive"> Deleting the underlying authentication account requires backend setup (Firebase Admin SDK) for security.</span>
                     Are you sure you want to proceed with deleting the database record?
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
                    Delete User Record
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </Dialog>
        </div>
    </TooltipProvider>
  );
}

    
