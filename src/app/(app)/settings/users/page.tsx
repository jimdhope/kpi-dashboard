'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Loader2, Search, ShieldAlert, UserCog, Briefcase, ShieldCheck, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { generateInitials } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  avatarUrl?: string | null;
  avatarInitials?: string | null;
  avatarBgColor?: string | null;
}

const roleIcons: Record<string, React.ReactNode> = {
  admin: <UserCog className="h-4 w-4 text-red-600" />,
  podManager: <Briefcase className="h-4 w-4 text-blue-600" />,
  teamLeader: <ShieldCheck className="h-4 w-4 text-green-600" />,
  competitionRunner: <ShieldCheck className="h-4 w-4 text-purple-600" />,
  agent: <UserRound className="h-4 w-4 text-gray-500" />,
};

const ALL_ROLES = ['admin', 'campaignManager', 'podManager', 'teamLeader', 'competitionRunner', 'agent'];

const formatRole = (role: string): string => {
  const labels: Record<string, string> = {
    admin: 'Admin',
    campaignManager: 'Campaign Manager',
    podManager: 'Pod Manager',
    teamLeader: 'Team Leader',
    competitionRunner: 'Competition Runner',
    agent: 'Agent',
  };
  return labels[role] || role;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoadingUsers(true);
      setError(null);
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        } else {
          setError("Failed to fetch users.");
        }
        const meRes = await fetch('/api/auth/session');
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUserId(meData.user?.id || null);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to fetch users.");
      } finally {
        setIsLoadingUsers(false);
      }
    }

    fetchData();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.roles?.some(role => role.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  const openAddDialog = () => {
    setSelectedUser(null);
    setDialogMode('add');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRoles([]);
    setIsFormOpen(true);
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setDialogMode('edit');
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRoles(user.roles || []);
    setIsFormOpen(true);
  };

  const openDeleteAlert = (user: User) => {
    setSelectedUser(user);
    setIsAlertOpen(true);
  };

  const toggleRole = (role: string) => {
    setFormRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleFormSubmit = async () => {
    if (!formName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Name is required." });
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      toast({ variant: "destructive", title: "Error", description: "Valid email is required." });
      return;
    }
    if (dialogMode === 'add' && formPassword.length < 8) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 8 characters." });
      return;
    }
    if (dialogMode === 'edit' && formPassword && formPassword.length < 8) {
      toast({ variant: "destructive", title: "Error", description: "A reset password must be at least 8 characters." });
      return;
    }
    if (formRoles.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "At least one role is required." });
      return;
    }

    setIsSaving(true);
    try {
      if (dialogMode === 'add') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            password: formPassword,
            roles: formRoles,
          }),
        });
        if (!res.ok) throw new Error('Failed to create user');
        toast({ title: "User Created", description: `User "${formName}" has been created.` });
      } else if (selectedUser) {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            roles: formRoles,
          }),
        });
        if (!res.ok) throw new Error('Failed to update user');
        if (formPassword) {
          const resetRes = await fetch(`/api/users/${selectedUser.id}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: formPassword }),
          });
          const resetResult = await resetRes.json().catch(() => ({}));
          if (!resetRes.ok) throw new Error(resetResult.error || 'Failed to reset password');
          toast({ title: "User and Password Updated", description: `${formName}'s password was reset and their existing sessions were ended.` });
        } else {
          toast({ title: "User Updated", description: `User "${formName}" has been updated.` });
        }
      }

      setIsFormOpen(false);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      console.error("Error saving user:", err);
      toast({ variant: "destructive", title: "Save Error", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      toast({ title: "User Deleted", description: `User "${selectedUser.name}" has been deleted.` });
      setUsers(users.filter(u => u.id !== selectedUser.id));
    } catch (err: any) {
      console.error("Error deleting user:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
    setIsAlertOpen(false);
    setSelectedUser(null);
  };

  const isDeletingSelf = (userId: string) => currentUserId === userId;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Manage Users</CardTitle>
              <CardDescription>View, add, edit, or delete user accounts and roles.</CardDescription>
            </div>
            <div className="flex gap-2 items-start flex-wrap">
              <div className="relative max-w-xs">
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
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog} disabled={isLoadingUsers}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{dialogMode === 'add' ? 'Add New User' : 'Edit User'}</DialogTitle>
                    <DialogDescription>
                      {dialogMode === 'add' ? 'Enter the details and select roles for the new user.' : `Make changes to ${selectedUser?.name || 'the user'}.`}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Jane Doe"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="agent@example.com"
                        disabled={dialogMode === 'edit'}
                      />
                      {dialogMode === 'edit' && (
                        <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Roles</Label>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        {ALL_ROLES.map((role) => (
                          <div key={role} className="flex flex-row items-center space-x-3 space-y-0">
                            <Checkbox
                              id={`role-${role}`}
                              checked={formRoles.includes(role)}
                              onCheckedChange={() => toggleRole(role)}
                              disabled={isSaving}
                            />
                            <Label htmlFor={`role-${role}`} className="font-normal cursor-pointer">
                              {formatRole(role)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">
                        {dialogMode === 'add' ? 'Password' : 'New Temporary Password (Optional)'}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={dialogMode === 'add' ? "Min. 8 characters" : "Leave blank to keep current password"}
                        disabled={isSaving || (dialogMode === 'edit' && selectedUser?.id === currentUserId)}
                      />
                      {dialogMode === 'edit' && (
                        <p className="text-xs text-muted-foreground">
                          {selectedUser?.id === currentUserId
                            ? 'Change your own password from Profile.'
                            : 'Setting a temporary password immediately ends all of this user’s existing sessions.'}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleFormSubmit} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isSaving ? 'Saving...' : (dialogMode === 'add' ? 'Create User' : 'Update User')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
            {error && !isLoadingUsers && (
              <div className="mb-4 text-center text-destructive">{error}</div>
            )}
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[60px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={`loading-${index}`}>
                      <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
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
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? `No users found matching "${searchTerm}".` : "No users found. Add a user to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {user.avatarInitials || generateInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                              {user.roles && user.roles.length > 0 && (roleIcons[user.roles[0]] || <UserRound className="h-4 w-4"/>)}
                              {(!user.roles || user.roles.length === 0) && <ShieldAlert className="h-4 w-4 text-orange-500"/>}
                              {user.roles?.map(r => formatRole(r)).join(', ') || 'No Role'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{user.roles?.map(r => formatRole(r)).join(', ') || 'No Role'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                            aria-label={`Edit ${user.name}`}
                            disabled={isLoadingUsers}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                  onClick={() => openDeleteAlert(user)}
                                  aria-label={`Delete ${user.name}`}
                                  disabled={isLoadingUsers || isDeletingSelf(user.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the user
                <span className="font-semibold"> "{selectedUser?.name}"</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
