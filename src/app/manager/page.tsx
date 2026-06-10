"use client";

import { useEffect, useState } from "react";
import { CompanySetup } from "@/components/CompanySetup";

interface Employee {
  _id: string;
  name: string;
  role: string;
}

interface QuizAttempt {
  _id: string;
  employeeId: string;
  trainingModuleId: string;
  score: number;
  passed: boolean;
  answers: { questionId: string; answer: string; isCorrect: boolean }[];
  completedAt: string;
}

interface RoleplaySession {
  _id: string;
  employeeId: string;
  trainingModuleId: string;
  scenarioTitle: string;
  status: string;
  evaluation?: {
    overallScore: number;
    summary: string;
    categories: { name: string; score: number; feedback: string; passed: boolean }[];
    weakAreas: string[];
    strengths: string[];
  };
}

interface Certification {
  _id: string;
  employeeId: string;
  trainingModuleId: string;
  recommended: boolean;
  confidence: number;
  reasoning: string;
  status: string;
  managerComments?: string;
}

interface TrainingModule {
  _id: string;
  title: string;
}

export default function ManagerPage() {
  const [companyId, setCompanyId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [roleplaySessions, setRoleplaySessions] = useState<RoleplaySession[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem("crewoz_companyId");
    if (saved) setCompanyId(saved);
  }, []);

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem("crewoz_companyId", companyId);
    loadData();
  }, [companyId]);

  async function loadData() {
    const [emps, training, attempts, sessions, certs] = await Promise.all([
      fetch(`/api/employees?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/training?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/quiz-attempts?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/roleplay?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/certifications?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setEmployees(emps);
    setModules(training.modules || []);
    setQuizAttempts(attempts);
    setRoleplaySessions(sessions);
    setCertifications(certs);
  }

  async function reviewCert(id: string, decision: "approved" | "rejected") {
    await fetch(`/api/certifications/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        managerComments: reviewComments[id] || "",
      }),
    });
    await loadData();
  }

  const empMap = Object.fromEntries(employees.map((e) => [e._id, e]));
  const modMap = Object.fromEntries(modules.map((m) => [m._id, m]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Manager Review Portal</h1>

      <div className="mb-6">
        <CompanySetup onSelect={setCompanyId} selectedId={companyId} />
      </div>

      {!companyId ? (
        <div className="empty-state">Select a company to review performance.</div>
      ) : (
        <div className="grid gap-6">
          <section className="card">
            <h2 className="mb-4 font-semibold">Quiz Results</h2>
            {quizAttempts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No quiz attempts yet.</p>
            ) : (
              <div className="space-y-3">
                {quizAttempts.map((attempt) => (
                  <div key={attempt._id} className="rounded border p-3 text-sm">
                    <div className="mb-2 flex justify-between">
                      <strong>{empMap[attempt.employeeId]?.name || attempt.employeeId}</strong>
                      <span className={attempt.passed ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                        {attempt.score}% {attempt.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                    <p className="text-[var(--muted)]">
                      {modMap[attempt.trainingModuleId]?.title || "Unknown module"} — {new Date(attempt.completedAt).toLocaleString()}
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[var(--primary)]">View answers</summary>
                      <ul className="mt-1 space-y-1">
                        {attempt.answers.map((a, i) => (
                          <li key={i} className={a.isCorrect ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                            {a.isCorrect ? "✓" : "✗"} {a.answer}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="mb-4 font-semibold">Roleplay Results</h2>
            {roleplaySessions.filter((s) => s.evaluation).length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No evaluated roleplay sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {roleplaySessions
                  .filter((s) => s.evaluation)
                  .map((session) => (
                    <div key={session._id} className="rounded border p-3 text-sm">
                      <div className="mb-2 flex justify-between">
                        <strong>{empMap[session.employeeId]?.name}</strong>
                        <span>Score: {session.evaluation!.overallScore}/100</span>
                      </div>
                      <p className="font-medium">{session.scenarioTitle}</p>
                      <p className="mt-1 text-[var(--muted)]">{session.evaluation!.summary}</p>
                      <div className="mt-2 grid gap-1 md:grid-cols-2">
                        {session.evaluation!.categories.map((cat, i) => (
                          <div key={i} className="rounded bg-gray-50 p-2 text-xs">
                            <strong>{cat.name}</strong> ({cat.score}) — {cat.feedback}
                          </div>
                        ))}
                      </div>
                      {session.evaluation!.weakAreas.length > 0 && (
                        <p className="mt-2 text-xs text-[var(--warning)]">
                          Weak areas: {session.evaluation!.weakAreas.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="mb-4 font-semibold">Certification Recommendations</h2>
            {certifications.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No certification recommendations yet.</p>
            ) : (
              <div className="space-y-4">
                {certifications.map((cert) => (
                  <div key={cert._id} className="rounded border p-4 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <strong>{empMap[cert.employeeId]?.name}</strong>
                        <span className="ml-2 text-[var(--muted)]">
                          — {modMap[cert.trainingModuleId]?.title}
                        </span>
                      </div>
                      <span className={`badge badge-${cert.status}`}>{cert.status}</span>
                    </div>
                    <p className="mb-1">
                      AI recommends: <strong>{cert.recommended ? "Certify" : "Do not certify"}</strong> ({Math.round(cert.confidence * 100)}% confidence)
                    </p>
                    <p className="mb-3 text-[var(--muted)]">{cert.reasoning}</p>
                    {cert.status === "pending" ? (
                      <div>
                        <textarea
                          className="input mb-2"
                          rows={2}
                          placeholder="Manager comments (used for AI learning)..."
                          value={reviewComments[cert._id] || ""}
                          onChange={(e) =>
                            setReviewComments({ ...reviewComments, [cert._id]: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <button className="btn btn-success" onClick={() => reviewCert(cert._id, "approved")}>
                            Approve Certification
                          </button>
                          <button className="btn btn-danger" onClick={() => reviewCert(cert._id, "rejected")}>
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      cert.managerComments && (
                        <p className="text-xs text-[var(--muted)]">Comments: {cert.managerComments}</p>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
