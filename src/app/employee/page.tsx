"use client";

import { useEffect, useState } from "react";
import { CompanySetup } from "@/components/CompanySetup";

interface Employee {
  _id: string;
  name: string;
  role: string;
}

interface TrainingSection {
  title: string;
  content: string;
  keyPoints: string[];
}

interface TrainingModule {
  _id: string;
  title: string;
  description: string;
  sections: TrainingSection[];
  estimatedMinutes: number;
}

interface Progress {
  status: string;
  completedSections: number[];
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface Quiz {
  _id: string;
  trainingModuleId: string;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}

interface RoleplaySession {
  _id: string;
  trainingModuleId: string;
  scenarioTitle: string;
  scenarioDescription: string;
  messages: { role: string; content: string }[];
  status: string;
  evaluation?: {
    overallScore: number;
    summary: string;
    weakAreas: string[];
    categories: { name: string; score: number; feedback: string; passed: boolean }[];
  };
}

interface Supplemental {
  _id: string;
  title: string;
  content: string;
}

type Tab = "training" | "quiz" | "roleplay" | "chat";

export default function EmployeePage() {
  const [companyId, setCompanyId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [supplemental, setSupplemental] = useState<Supplemental[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [currentSection, setCurrentSection] = useState(0);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [passedModules, setPassedModules] = useState<Set<string>>(new Set());
  const [roleplaySession, setRoleplaySession] = useState<RoleplaySession | null>(null);
  const [roleplayInput, setRoleplayInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("training");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedCompany = localStorage.getItem("crewoz_companyId");
    const savedEmployee = localStorage.getItem("crewoz_employeeId");
    if (savedCompany) setCompanyId(savedCompany);
    if (savedEmployee) setEmployeeId(savedEmployee);
  }, []);

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem("crewoz_companyId", companyId);
    fetch(`/api/employees?companyId=${companyId}`)
      .then((r) => r.json())
      .then((emps: Employee[]) => {
        setEmployees(emps);
        if (!employeeId) {
          const alex = emps.find((e) => e.name === "Alex Rivera");
          if (alex) setEmployeeId(alex._id);
        }
      });
  }, [companyId, employeeId]);

  useEffect(() => {
    if (!companyId || !employeeId) return;
    localStorage.setItem("crewoz_employeeId", employeeId);
    loadTraining();
  }, [companyId, employeeId]);

  async function loadTraining() {
    const [data, attempts] = await Promise.all([
      fetch(`/api/training?companyId=${companyId}&employeeId=${employeeId}`).then((r) => r.json()),
      fetch(`/api/quiz-attempts?companyId=${companyId}&employeeId=${employeeId}`).then((r) => r.json()),
    ]);
    setModules(data.modules || []);
    setProgress(data.progress || {});
    setSupplemental(data.supplemental || []);
    setPassedModules(
      new Set(
        (attempts as { trainingModuleId: string; passed: boolean }[])
          .filter((a) => a.passed)
          .map((a) => a.trainingModuleId)
      )
    );

    if (data.modules?.length > 0 && !selectedModule) {
      setSelectedModule(data.modules[0]._id);
    }
  }

  async function loadQuiz(moduleId: string) {
    const qs = await fetch(`/api/quizzes?trainingModuleId=${moduleId}`).then((r) => r.json());
    setQuizzes(qs);
    setQuizAnswers({});
    setQuizResult(null);
  }

  async function completeSection(moduleId: string, sectionIndex: number, isLast: boolean) {
    await fetch(`/api/training/${moduleId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        employeeId,
        sectionIndex,
        complete: isLast,
      }),
    });
    await loadTraining();
  }

  async function submitQuiz(quizId: string) {
    setLoading(true);
    const answers = Object.entries(quizAnswers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
    const res = await fetch(`/api/quizzes/${quizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, employeeId, answers }),
    });
    const result = await res.json();
    if (!res.ok) {
      alert(result.error || "Quiz submission failed. Wait a minute if rate-limited, then retry.");
      setLoading(false);
      return;
    }
    setQuizResult({ score: result.score, passed: result.passed });
    if (result.passed) {
      setPassedModules((prev) => new Set([...prev, selectedModule]));
    }
    setLoading(false);
  }

  async function startRoleplay(moduleId: string) {
    setLoading(true);
    const res = await fetch("/api/roleplay/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, employeeId, trainingModuleId: moduleId }),
    });
    const session = await res.json();
    if (!res.ok) {
      alert(session.error || "Could not start roleplay.");
      setLoading(false);
      return;
    }
    setRoleplaySession(session);
    setLoading(false);
  }

  async function sendRoleplayMessage() {
    if (!roleplaySession || !roleplayInput.trim()) return;
    setLoading(true);
    const updated = await fetch(`/api/roleplay/${roleplaySession._id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: roleplayInput }),
    }).then((r) => r.json());
    setRoleplaySession(updated);
    setRoleplayInput("");
    setLoading(false);

    if (updated.status === "completed") {
      const evaluated = await fetch(`/api/roleplay/${updated._id}/evaluate`, {
        method: "POST",
      }).then((r) => r.json());
      setRoleplaySession(evaluated);

      await fetch("/api/certifications/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          employeeId,
          trainingModuleId: updated.trainingModuleId,
        }),
      });
    }
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory((h) => [...h, { role: "user", content: userMsg }]);
    setChatLoading(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        employeeId,
        message: userMsg,
        history: chatHistory,
      }),
    }).then((r) => r.json());
    setChatHistory((h) => [...h, { role: "assistant", content: res.response }]);
    setChatLoading(false);
  }

  const activeModule = modules.find((m) => m._id === selectedModule);
  const moduleProgress = selectedModule ? progress[selectedModule] : null;
  const quiz = quizzes.find((q) => q.trainingModuleId === selectedModule);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Employee Portal</h1>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <CompanySetup onSelect={setCompanyId} selectedId={companyId} />
        {companyId && (
          <div className="card">
            <h3 className="mb-3 font-semibold">Select Employee</h3>
            <select
              className="input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Choose yourself...</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} ({e.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!companyId || !employeeId ? (
        <div className="empty-state">Select company and employee to continue.</div>
      ) : modules.length === 0 ? (
        <div className="empty-state">
          Loading demo training… refresh in a few seconds.
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {(["training", "quiz", "roleplay", "chat"] as Tab[]).map((t) => (
              <button
                key={t}
                className={`btn ${tab === t ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setTab(t);
                  if (t === "quiz" && selectedModule) loadQuiz(selectedModule);
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <select
              className="input max-w-md"
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentSection(0);
                setRoleplaySession(null);
                setQuizResult(null);
              }}
            >
              {modules.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title} ({progress[m._id]?.status || "assigned"})
                </option>
              ))}
            </select>
          </div>

          {tab === "training" && activeModule && (
            <div className="card">
              <h2 className="mb-2 text-lg font-semibold">{activeModule.title}</h2>
              <p className="mb-4 text-sm text-[var(--muted)]">{activeModule.description}</p>
              {moduleProgress?.status === "completed" && (
                <p className="mb-4 text-sm text-[var(--success)]">Training completed</p>
              )}
              {activeModule.sections[currentSection] && (
                <div>
                  <h3 className="mb-2 font-medium">
                    Section {currentSection + 1}: {activeModule.sections[currentSection].title}
                  </h3>
                  <div className="mb-4 whitespace-pre-wrap text-sm">
                    {activeModule.sections[currentSection].content}
                  </div>
                  <ul className="mb-4 list-disc pl-5 text-sm">
                    {activeModule.sections[currentSection].keyPoints.map((kp, i) => (
                      <li key={i}>{kp}</li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    {currentSection > 0 && (
                      <button className="btn btn-secondary" onClick={() => setCurrentSection((s) => s - 1)}>
                        Previous
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        const isLast = currentSection === activeModule.sections.length - 1;
                        await completeSection(activeModule._id, currentSection, isLast);
                        if (!isLast) setCurrentSection((s) => s + 1);
                      }}
                    >
                      {currentSection === activeModule.sections.length - 1 ? "Complete Training" : "Next Section"}
                    </button>
                  </div>
                </div>
              )}
              {supplemental.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="mb-2 font-semibold">Supplemental Training (from roleplay weaknesses)</h3>
                  {supplemental.map((s) => (
                    <div key={s._id} className="mb-3 rounded border p-3 text-sm">
                      <strong>{s.title}</strong>
                      <div className="mt-1 whitespace-pre-wrap">{s.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "quiz" && (
            <div className="card">
              {moduleProgress?.status !== "completed" ? (
                <p className="text-sm text-[var(--muted)]">Complete training before taking the quiz.</p>
              ) : !quiz ? (
                <button className="btn btn-primary" onClick={() => loadQuiz(selectedModule)}>
                  Load Quiz
                </button>
              ) : quizResult ? (
                <div>
                  <h2 className="mb-2 text-lg font-semibold">Quiz Results</h2>
                  <p className={`text-lg font-bold ${quizResult.passed ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    Score: {quizResult.score}% — {quizResult.passed ? "Passed" : "Failed"}
                  </p>
                  {!quizResult.passed && (
                    <p className="mt-2 text-sm text-[var(--muted)]">Review training and retake the quiz.</p>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="mb-4 text-lg font-semibold">{quiz.title}</h2>
                  {quiz.questions.map((q, i) => (
                    <div key={q.id} className="mb-4">
                      <p className="mb-2 font-medium">{i + 1}. {q.question}</p>
                      <div className="space-y-1">
                        {q.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={quizAnswers[q.id] === opt}
                              onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    className="btn btn-primary"
                    disabled={loading || Object.keys(quizAnswers).length < quiz.questions.length}
                    onClick={() => submitQuiz(quiz._id)}
                  >
                    Submit Quiz
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "roleplay" && (
            <div className="card">
              {!roleplaySession ? (
                <div>
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    Pass the quiz first, then start a roleplay scenario generated from company documents.
                  </p>
                  <button
                    className="btn btn-primary"
                    disabled={loading || !passedModules.has(selectedModule)}
                    onClick={() => startRoleplay(selectedModule)}
                  >
                    Start Roleplay
                  </button>
                  {!passedModules.has(selectedModule) && (
                    <p className="mt-2 text-xs text-[var(--muted)]">Complete and pass the quiz first.</p>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="mb-1 font-semibold">{roleplaySession.scenarioTitle}</h2>
                  <p className="mb-4 text-sm text-[var(--muted)]">{roleplaySession.scenarioDescription}</p>
                  <div className="mb-4 max-h-80 space-y-2 overflow-y-auto rounded border p-3">
                    {roleplaySession.messages.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded p-2 text-sm ${
                          m.role === "employee" ? "ml-8 bg-blue-50" : "mr-8 bg-gray-50"
                        }`}
                      >
                        <strong>{m.role === "employee" ? "You" : "Customer"}:</strong> {m.content}
                      </div>
                    ))}
                  </div>
                  {roleplaySession.status === "evaluated" && roleplaySession.evaluation ? (
                    <div className="rounded border border-green-200 bg-green-50 p-3 text-sm">
                      <strong>Evaluation: {roleplaySession.evaluation.overallScore}/100</strong>
                      <p className="mt-1">{roleplaySession.evaluation.summary}</p>
                      {roleplaySession.evaluation.weakAreas.length > 0 && (
                        <p className="mt-1">Weak areas: {roleplaySession.evaluation.weakAreas.join(", ")}</p>
                      )}
                    </div>
                  ) : roleplaySession.status === "active" || roleplaySession.status === "completed" ? (
                    roleplaySession.status === "active" ? (
                      <div className="flex gap-2">
                        <input
                          className="input"
                          value={roleplayInput}
                          onChange={(e) => setRoleplayInput(e.target.value)}
                          placeholder="Your response..."
                          onKeyDown={(e) => e.key === "Enter" && sendRoleplayMessage()}
                        />
                        <button className="btn btn-primary" onClick={sendRoleplayMessage} disabled={loading}>
                          Send
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm">Evaluating roleplay...</p>
                    )
                  ) : null}
                </div>
              )}
            </div>
          )}

          {tab === "chat" && (
            <div className="card">
              <h2 className="mb-4 font-semibold">AI Manager Chat</h2>
              <div className="mb-4 max-h-80 space-y-2 overflow-y-auto rounded border p-3">
                {chatHistory.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Ask questions about company procedures.</p>
                ) : (
                  chatHistory.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded p-2 text-sm ${
                        m.role === "user" ? "ml-8 bg-blue-50" : "mr-8 bg-gray-50"
                      }`}
                    >
                      <strong>{m.role === "user" ? "You" : "AI Manager"}:</strong> {m.content}
                    </div>
                  ))
                )}
                {chatLoading && <p className="text-sm text-[var(--muted)]">Thinking...</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about procedures, policies..."
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                />
                <button className="btn btn-primary" onClick={sendChat} disabled={chatLoading}>
                  Send
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
