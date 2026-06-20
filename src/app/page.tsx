import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold">CrewOS</h1>
        <p className="text-lg text-[var(--muted)]">
          AI Workforce Manager for Small Businesses
        </p>
      </div>

      <div className="mb-8 rounded-lg border-2 border-[var(--primary)] bg-blue-50 p-6">
        <h2 className="mb-2 text-xl font-bold text-[var(--primary)]">Live Demo — Sunrise Coffee Co.</h2>
        <p className="mb-4 text-sm">
          Just run <code className="rounded bg-white px-2 py-0.5">npm run dev</code> — the app
          auto-loads a coffee shop with 6 real SOPs, 3 employees, training modules, and quizzes.
          No files to upload. No MongoDB setup.
        </p>
        <ol className="mb-4 grid gap-2 text-sm md:grid-cols-2">
          <li>
            <strong>1. Owner</strong> — See processed SOPs &amp; employees
          </li>
          <li>
            <strong>2. Employee</strong> — Alex Rivera → Quiz (pick 1st answer each)
          </li>
          <li>
            <strong>3. Roleplay</strong> — Reply once → certification
          </li>
          <li>
            <strong>4. Manager</strong> — Approve cert → generate schedule
          </li>
          <li>
            <strong>5. Agent</strong> — Ask workforce status via MongoDB MCP
          </li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/owner" className="btn btn-primary">
            Start Demo → Owner
          </Link>
          <Link href="/employee" className="btn btn-secondary">
            Employee Portal
          </Link>
          <Link href="/agent" className="btn btn-secondary">
            Workforce Agent
          </Link>
        </div>
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/owner" className="card transition hover:shadow-md">
          <h2 className="mb-2 text-lg font-semibold">Owner Dashboard</h2>
          <p className="text-sm text-[var(--muted)]">
            SOPs, employees, AI schedules — Sunrise Coffee Co. pre-loaded.
          </p>
        </Link>
        <Link href="/employee" className="card transition hover:shadow-md">
          <h2 className="mb-2 text-lg font-semibold">Employee Portal</h2>
          <p className="text-sm text-[var(--muted)]">
            Training, quizzes, roleplay — try as Alex Rivera (Barista).
          </p>
        </Link>
        <Link href="/manager" className="card transition hover:shadow-md">
          <h2 className="mb-2 text-lg font-semibold">Manager Review</h2>
          <p className="text-sm text-[var(--muted)]">
            Approve certifications and AI-generated schedules.
          </p>
        </Link>
        <Link href="/agent" className="card transition hover:shadow-md border-[var(--primary)]">
          <h2 className="mb-2 text-lg font-semibold">Workforce Agent</h2>
          <p className="text-sm text-[var(--muted)]">
            ADK + MongoDB MCP — query onboarding status live.
          </p>
        </Link>
      </div>
    </div>
  );
}
