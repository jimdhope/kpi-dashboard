"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { PasswordChangeCard } from "@/components/profile/password-change-card";

export function ForcedPasswordChange() {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <Image src="/logo.svg" alt="KPI Quest" width={88} height={88} className="mx-auto" unoptimized />
          <h1 className="mt-3 text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your temporary password must be replaced before you continue.</p>
        </div>
        <PasswordChangeCard onSuccess={() => { router.replace("/dashboard"); router.refresh(); }} />
      </div>
    </main>
  );
}
