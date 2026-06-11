"use client";

import { useState } from "react";

export default function AgentPage() {
  const [messages, setMessages] = useState<{ role: "user" | "agent"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, sessionId: sessionId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "agent", content: `${data.error}\n\n${data.hint || ""}` },
        ]);
      } else {
        if (data.sessionId) setSessionId(data.sessionId);
        setMessages((m) => [...m, { role: "agent", content: data.response }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", content: "Could not reach the agent. Start ADK api_server on port 8000." },
      ]);
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">CrewOS Agent</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        ADK agent with MongoDB MCP — plans and executes workforce tasks using your Atlas data.
      </p>
      <div className="card">
        <div className="mb-4 max-h-96 space-y-2 overflow-y-auto rounded border p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Try: &quot;List all employees for Sunrise Coffee Co.&quot; or &quot;What training modules exist?&quot;
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`rounded p-2 text-sm ${m.role === "user" ? "ml-8 bg-blue-50" : "mr-8 bg-gray-50"}`}
              >
                <strong>{m.role === "user" ? "You" : "CrewOS Agent"}:</strong>{" "}
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))
          )}
          {loading && <p className="text-sm text-[var(--muted)]">Agent thinking (calling MongoDB MCP tools)...</p>}
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the workforce agent..."
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn btn-primary" onClick={send} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
