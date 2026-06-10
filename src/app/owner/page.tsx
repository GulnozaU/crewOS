"use client";

import { useEffect, useState } from "react";
import { CompanySetup } from "@/components/CompanySetup";

interface Document {
  _id: string;
  originalName: string;
  status: string;
  processingError?: string;
  createdAt: string;
}

interface Employee {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Certification {
  _id: string;
  employeeId: string;
  recommended: boolean;
  confidence: number;
  reasoning: string;
  status: string;
}

interface Schedule {
  _id: string;
  weekStartDate: string;
  reasoning: string;
  status: string;
  shifts: { employeeName: string; day: string; startTime: string; endTime: string; role: string }[];
}

export default function OwnerPage() {
  const [companyId, setCompanyId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [uploading, setUploading] = useState(false);
  const [empForm, setEmpForm] = useState({ name: "", email: "", role: "" });
  const [generatingSchedule, setGeneratingSchedule] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem("crewoz_companyId", companyId);
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [companyId]);

  useEffect(() => {
    const saved = localStorage.getItem("crewoz_companyId");
    if (saved) setCompanyId(saved);
  }, []);

  async function loadData() {
    if (!companyId) return;
    const [docs, emps, certs, scheds] = await Promise.all([
      fetch(`/api/documents?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/employees?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/certifications?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/schedules?companyId=${companyId}`).then((r) => r.json()),
    ]);
    setDocuments(docs);
    setEmployees(emps);
    setCertifications(certs);
    setSchedules(scheds);
  }

  async function uploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    const form = new FormData();
    form.append("companyId", companyId);
    form.append("file", file);
    await fetch("/api/documents/upload", { method: "POST", body: form });
    await loadData();
    setUploading(false);
    e.target.value = "";
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...empForm }),
    });
    setEmpForm({ name: "", email: "", role: "" });
    await loadData();
  }

  async function generateSchedule() {
    setGeneratingSchedule(true);
    await fetch("/api/schedules/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    await loadData();
    setGeneratingSchedule(false);
  }

  async function reviewCert(id: string, decision: "approved" | "rejected") {
    const comments = prompt(`Comments for ${decision}:`) || "";
    await fetch(`/api/certifications/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, managerComments: comments }),
    });
    await loadData();
  }

  async function reviewSchedule(id: string, decision: "approved" | "rejected") {
    const comments = prompt(`Comments for ${decision}:`) || "";
    await fetch(`/api/schedules/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, managerComments: comments }),
    });
    await loadData();
  }

  const empMap = Object.fromEntries(employees.map((e) => [e._id, e.name]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Owner Dashboard</h1>

      <div className="mb-6">
        <CompanySetup onSelect={setCompanyId} selectedId={companyId} />
      </div>

      {!companyId ? (
        <div className="empty-state">Select or create a company to continue.</div>
      ) : (
        <div className="grid gap-6">
          <section className="card">
            <h2 className="mb-4 font-semibold">Upload Documents</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Upload SOPs, handbooks, or training manuals (PDF or text). Gemini will process them and generate training.
            </p>
            <input
              type="file"
              accept=".pdf,.txt,.md,.text"
              onChange={uploadDocument}
              disabled={uploading}
            />
            {uploading && <p className="mt-2 text-sm">Uploading and processing...</p>}
            <div className="mt-4 space-y-2">
              {documents.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No documents uploaded.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc._id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <span>{doc.originalName}</span>
                    <span className={`badge badge-${doc.status === "processed" ? "completed" : doc.status === "failed" ? "rejected" : "processing"}`}>
                      {doc.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="mb-4 font-semibold">Employees</h2>
            <form onSubmit={addEmployee} className="mb-4 grid gap-2 md:grid-cols-4">
              <input className="input" placeholder="Name" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} required />
              <input className="input" placeholder="Email" type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} required />
              <input className="input" placeholder="Role" value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} required />
              <button type="submit" className="btn btn-primary">Add Employee</button>
            </form>
            {employees.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No employees yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp._id} className="border-b">
                      <td className="py-2">{emp.name}</td>
                      <td>{emp.email}</td>
                      <td>{emp.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2 className="mb-4 font-semibold">Certification Recommendations</h2>
            {certifications.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No recommendations yet.</p>
            ) : (
              <div className="space-y-3">
                {certifications.map((cert) => (
                  <div key={cert._id} className="rounded border p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <strong>{empMap[cert.employeeId] || cert.employeeId}</strong>
                      <span className={`badge badge-${cert.status}`}>{cert.status}</span>
                    </div>
                    <p className="mb-1">
                      {cert.recommended ? "Recommended" : "Not recommended"} ({Math.round(cert.confidence * 100)}% confidence)
                    </p>
                    <p className="mb-2 text-[var(--muted)]">{cert.reasoning}</p>
                    {cert.status === "pending" && (
                      <div className="flex gap-2">
                        <button className="btn btn-success" onClick={() => reviewCert(cert._id, "approved")}>Approve</button>
                        <button className="btn btn-danger" onClick={() => reviewCert(cert._id, "rejected")}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Schedule Recommendations</h2>
              <button className="btn btn-primary" onClick={generateSchedule} disabled={generatingSchedule || employees.length === 0}>
                {generatingSchedule ? "Generating..." : "Generate Schedule"}
              </button>
            </div>
            {schedules.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No schedules yet.</p>
            ) : (
              <div className="space-y-4">
                {schedules.map((sched) => (
                  <div key={sched._id} className="rounded border p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <strong>Week of {sched.weekStartDate}</strong>
                      <span className={`badge badge-${sched.status}`}>{sched.status}</span>
                    </div>
                    <p className="mb-2 text-[var(--muted)]">{sched.reasoning}</p>
                    <table className="mb-2 w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="py-1 text-left">Employee</th>
                          <th>Day</th>
                          <th>Time</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sched.shifts.map((s, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1">{s.employeeName}</td>
                            <td>{s.day}</td>
                            <td>{s.startTime} - {s.endTime}</td>
                            <td>{s.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sched.status === "pending" && (
                      <div className="flex gap-2">
                        <button className="btn btn-success" onClick={() => reviewSchedule(sched._id, "approved")}>Approve</button>
                        <button className="btn btn-danger" onClick={() => reviewSchedule(sched._id, "rejected")}>Reject</button>
                      </div>
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
