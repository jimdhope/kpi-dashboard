import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-2">404</h2>
        <p className="text-muted-foreground mb-4">Page not found</p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}