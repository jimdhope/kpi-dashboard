import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="center-page">
      <div className="card form-card">
        <div>
          <p className="eyebrow">KPI Quest</p>
          <h1>Page not found</h1>
          <p className="muted">That V3 route does not exist yet.</p>
        </div>
        <Link className="primary-button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
