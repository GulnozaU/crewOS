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

      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <Link href="/owner" className="card transition hover:shadow-md">
          <h2 className="mb-2 text-lg font-semibold">Owner Dashboard</h2>
          <p className="text-sm text-[var(--muted)]">
            Upload SOPs, manage employees, review AI recommendations and schedules.
          </p>
        </Link>
        <Link href="/employee" className="card transition hover:shadow-md">
          <h2 className="mb-2 text-lg font-semibold">Employee Portal</h2>
          <p className="text-sm text-[var(--muted)]">
            Complete training, take quizzes, chat with AI manager, roleplay scenarios.
          </p>
        </Link>
        <Link href="/manager" className="card transition hover:shadow-md">
          <h2 className="mb-2 text-lg font-semibold">Manager Review</h2>
          <p className="text-sm text-[var(--muted)]">
            Review quiz results, roleplay evaluations, approve certifications and schedules.
          </p>
        </Link>
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">Workflow</h2>
        <ol className="grid gap-2 text-sm md:grid-cols-2">
          {[
            "Upload company documents",
            "Gemini processes & generates training",
            "Quiz questions auto-generated",
            "Employee completes training",
            "Employee takes & scores quiz",
            "Employee roleplay simulation",
            "AI evaluates roleplay",
            "AI certification recommendation",
            "Manager approves/rejects",
            "AI schedule recommendation",
            "Manager approves schedule",
          ].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-[var(--primary)]">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
