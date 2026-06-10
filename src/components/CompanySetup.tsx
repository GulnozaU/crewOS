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

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then(setCompanies)
      .catch(console.error);
  }, []);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const company = await res.json();
      setCompanies((prev) => [company, ...prev]);
      onSelect(company._id);
      setName("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mb-3 font-semibold">Select Company</h3>
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
