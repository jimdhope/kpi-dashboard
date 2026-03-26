"use client";

import { useMemo, useState } from "react";
import { AppUser, USER_ROLES, UserRole } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UsersAdminProps {
  initialUsers: AppUser[];
  currentUserId: string;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
}

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  roles: ["agent"],
};

export function UsersAdmin({ initialUsers, currentUserId }: UsersAdminProps) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        user.roles.join(" ").toLowerCase().includes(needle)
      );
    });
  }, [query, users]);

  function resetForm() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(user: AppUser) {
    setMode("edit");
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      roles: user.roles,
    });
    setError(null);
  }

  function toggleRole(role: UserRole) {
    setForm((current) => {
      const nextRoles = current.roles.includes(role)
        ? current.roles.filter((currentRole) => currentRole !== role)
        : [...current.roles, role];

      return {
        ...current,
        roles: nextRoles.length > 0 ? nextRoles : current.roles,
      };
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const url = mode === "create" ? "/api/users" : `/api/users/${editingId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        mode === "create"
          ? form
          : {
              name: form.name,
              roles: form.roles,
            },
      ),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save user.");
      return;
    }

    if (mode === "create") {
      setUsers((current) => [...current, payload].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setUsers((current) => current.map((user) => (user.id === payload.id ? payload : user)));
    }

    resetForm();
  }

  async function removeUser(id: string) {
    if (id === currentUserId) {
      setError("You cannot delete the active admin user.");
      return;
    }

    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Failed to delete user.");
      return;
    }

    setUsers((current) => current.filter((user) => user.id !== id));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>User directory</CardTitle>
              <CardDescription>
                Admin-managed users backed by PostgreSQL and Prisma.
              </CardDescription>
            </div>
            <Input
              placeholder="Search users..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-350px)] min-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span
                            key={role}
                            className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(user)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeUser(user.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{mode === "create" ? "Create user" : "Edit user"}</CardTitle>
            <CardDescription>
              The first vertical slice: admin user management.
            </CardDescription>
          </div>
          {mode === "edit" && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              New user
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                type="email"
                disabled={mode === "edit"}
                required
              />
            </div>

            {mode === "create" && (
              <div className="grid gap-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input
                  id="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  minLength={8}
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-4 border rounded-md p-4 bg-background/50">
                {USER_ROLES.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={form.roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <Label
                      htmlFor={`role-${role}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {role}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Saving..."
                : mode === "create"
                ? "Create user"
                : "Update user"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
