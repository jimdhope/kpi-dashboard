"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleLogout} type="button" className="gap-2">
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
