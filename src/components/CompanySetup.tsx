"use client";

import { useEffect, useState } from "react";

interface Company {
  _id: string;
  name: string;
}

interface Props {
  onSelect: (companyId: string) => void;
  selectedId?: string;
}

export function CompanySetup({ onSelect, selectedId }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/companies")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error || "Failed to load companies");
        }
        if (Array.isArray(data)) {
          setCompanies(data);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load companies");
      });
  }, []);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const company = await res.json();
      if (!res.ok) {
        throw new Error(company.error || "Failed to create company");
      }
      setCompanies((prev) => [company, ...prev]);
      onSelect(company._id);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mb-3 font-semibold">Select Company</h3>
      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {companies.length > 0 ? (
        <select
          className="input mb-3"
          value={selectedId || ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">Choose a company...</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="mb-3 text-sm text-[var(--muted)]">No companies yet.</p>
      )}
      <form onSubmit={createCompany} className="flex gap-2">
        <input
          className="input"
          placeholder="New company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          Create
        </button>
      </form>
    </div>
  );
}
