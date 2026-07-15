"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught application error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <main className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">KPI Quest hit an unexpected problem</h1>
          <p className="text-muted-foreground">
            Try loading this part of the application again. If the problem continues, contact an administrator.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
