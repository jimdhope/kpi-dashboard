"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/lib/contracts";

function getDefaultRoute(user: AppUser): string {
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "Unable to sign in.");
      return;
    }

    router.replace(getDefaultRoute(payload.user));
    router.refresh();
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">KPI Quest</p>
        <h1>V3 login</h1>
        <p className="muted">
          This workspace uses database-backed sessions. Sign in with the seeded admin account or a user created here.
        </p>
      </div>

      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
      </label>

      <label className="field">
        <span>Password</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
      </label>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
