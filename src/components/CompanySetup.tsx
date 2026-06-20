"use client";

import { useEffect, useState } from "react";

interface Company {
  _id: string;
  name: string;
}

interface DemoStatus {
  ready: boolean;
  company: { _id: string; name: string } | null;
  employees: { _id: string; name: string; role: string }[];
  documents: { name: string; status: string }[];
  trainingModules: number;
  error?: string;
}

const DEMO_NAME = "Sunrise Coffee Co.";

interface Props {
  onSelect: (companyId: string) => void;
  selectedId?: string;
}

export function CompanySetup({ onSelect, selectedId }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [demo, setDemo] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const statusRes = await fetch("/api/demo/status");
        const status: DemoStatus = await statusRes.json();
        setDemo(status);
        if (!statusRes.ok) {
          throw new Error(status.error || "Demo setup failed");
        }

        const res = await fetch("/api/companies");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load companies");
        }
        if (Array.isArray(data)) {
          setCompanies(data);
          const demoCo = data.find((c: Company) => c.name === DEMO_NAME);
          if (demoCo && !selectedId) {
            onSelect(demoCo._id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load demo");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card">
      <h3 className="mb-1 font-semibold">Demo Company</h3>
      <p className="mb-3 text-sm text-[var(--muted)]">
        <strong>{DEMO_NAME}</strong> — 6 SOPs, 3 employees, training &amp; quizzes ready. No setup
        required.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading demo data…</p>
      ) : error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : demo?.ready ? (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          ✓ {demo.documents.filter((d) => d.status === "processed").length} SOPs processed ·{" "}
          {demo.trainingModules} training modules · {demo.employees.length} employees
        </div>
      ) : null}

      {companies.length > 0 ? (
        <select
          className="input"
          value={selectedId || ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Choose a company…</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : !loading ? (
        <p className="text-sm text-[var(--muted)]">Starting demo… refresh in a few seconds.</p>
      ) : null}
    </div>
  );
}
