#!/usr/bin/env node
/**
 * End-to-end workflow audit for CrewOS.
 * Usage: node scripts/e2e-audit.mjs [BASE_URL]
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.argv[2] || "http://localhost:3000";
const SOP = resolve(process.cwd(), "samples/sops/01-opening-procedures.txt");

const results = [];

function record(stage, status, detail = "") {
  results.push({ stage, status, detail });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⚠";
  console.log(`${icon} [${status}] ${stage}${detail ? `: ${detail}` : ""}`);
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDocProcessed(companyId, docId, maxWait = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const { body: docs } = await api(`/api/documents?companyId=${companyId}`);
    const doc = docs.find((d) => d._id === docId);
    if (doc?.status === "failed") throw new Error(doc.processingError || "processing failed");
    if (doc?.status === "processed") {
      const { body: training } = await api(`/api/training?companyId=${companyId}`);
      if (training.modules?.length > 0) return doc;
    }
    await sleep(5000);
  }
  throw new Error("timeout waiting for document processing and training generation");
}

async function main() {
  console.log(`\n=== CrewOS E2E Audit ===\nBase: ${BASE}\n`);

  let companyId, docId, employeeId, moduleId, quizId, roleplayId, certId, scheduleId;

  // 1. Create company
  try {
    const { ok, body } = await api("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Audit Co ${Date.now()}`, industry: "Test" }),
    });
    if (!ok || !body._id) throw new Error(JSON.stringify(body));
    companyId = body._id;
    record("1. Create company", "PASS", `id=${companyId}`);
  } catch (e) {
    record("1. Create company", "FAIL", e.message);
    return printReport();
  }

  // 2. Upload SOP
  try {
    const form = new FormData();
    form.append("companyId", companyId);
    form.append("file", new Blob([readFileSync(SOP)], { type: "text/plain" }), "01-opening-procedures.txt");
    const res = await fetch(`${BASE}/api/documents/upload`, { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok || !body._id) throw new Error(JSON.stringify(body));
    docId = body._id;
    record("2. Upload SOP", "PASS", `id=${docId}`);
  } catch (e) {
    record("2. Upload SOP", "FAIL", e.message);
    return printReport();
  }

  // 3-4. Process SOP + generate training
  try {
    console.log("   ... waiting for Gemini processing (up to 2 min)");
    await waitForDocProcessed(companyId, docId);
    const { body: modules } = await api(`/api/training?companyId=${companyId}`);
    if (!modules.modules?.length) throw new Error("no training modules created");
    moduleId = modules.modules[0]._id;
    record("3. Process SOP with Gemini", "PASS");
    record("4. Generate training modules", "PASS", `module=${moduleId}, count=${modules.modules.length}`);
  } catch (e) {
    record("3. Process SOP with Gemini", "FAIL", e.message);
    record("4. Generate training modules", "FAIL", "blocked by step 3");
    return printReport();
  }

  // 5. Create employee
  try {
    const { ok, body } = await api("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        name: "Audit Employee",
        email: `audit${Date.now()}@test.com`,
        role: "Barista",
      }),
    });
    if (!ok || !body._id) throw new Error(JSON.stringify(body));
    employeeId = body._id;
    record("5. Create employee", "PASS", `id=${employeeId}`);
  } catch (e) {
    record("5. Create employee", "FAIL", e.message);
    return printReport();
  }

  // 6. Assign training
  try {
    const { body } = await api(`/api/training?companyId=${companyId}&employeeId=${employeeId}`);
    const prog = body.progress?.[moduleId];
    if (!prog) throw new Error("no training progress assigned");
    record("6. Assign training", "PASS", `status=${prog.status}`);
  } catch (e) {
    record("6. Assign training", "FAIL", e.message);
    return printReport();
  }

  // Complete all training sections
  try {
    const { body: training } = await api(`/api/training?companyId=${companyId}&employeeId=${employeeId}`);
    const mod = training.modules.find((m) => m._id === moduleId);
    for (let i = 0; i < mod.sections.length; i++) {
      const isLast = i === mod.sections.length - 1;
      const { ok } = await api(`/api/training/${moduleId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, employeeId, sectionIndex: i, complete: isLast }),
      });
      if (!ok) throw new Error(`section ${i} failed`);
    }
    record("6b. Complete training sections", "PASS");
  } catch (e) {
    record("6b. Complete training sections", "FAIL", e.message);
    return printReport();
  }

  // 7-8. Quiz
  try {
    const { body: quizzes } = await api(`/api/quizzes?trainingModuleId=${moduleId}`);
    if (!quizzes?.length) throw new Error("no quiz found");
    quizId = quizzes[0]._id;
    let attempt = null;
    for (let optIdx = 0; optIdx < 4 && !attempt?.passed; optIdx++) {
      const answers = quizzes[0].questions.map((q) => ({
        questionId: q.id,
        answer: q.options[optIdx % q.options.length] || q.options[0],
      }));
      const { ok, body } = await api(`/api/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, employeeId, answers }),
      });
      if (!ok) throw new Error(JSON.stringify(body));
      attempt = body;
    }
    if (!attempt?.passed) {
      record("7. Complete quiz", "WARNING", `score=${attempt?.score}% — did not reach passing threshold; roleplay may block`);
    } else {
      record("7. Complete quiz", "PASS", `score=${attempt.score}% passed=${attempt.passed}`);
    }
    record("8. Store quiz results", attempt?._id ? "PASS" : "FAIL", attempt?._id ? `attemptId=${attempt._id}` : "no attempt stored");
    if (!attempt?.passed) {
      record("9. Start roleplay", "FAIL", "requires passed quiz");
      record("10. Complete roleplay", "FAIL", "blocked by step 9");
      record("11. Generate certification recommendation", "FAIL", "blocked");
      record("12. Manager approve/reject", "FAIL", "blocked");
      record("13. Generate schedule recommendation", "FAIL", "blocked");
      record("14. Store all results in MongoDB", "WARNING", "partial data only");
      return printReport();
    }
  } catch (e) {
    record("7. Complete quiz", "FAIL", e.message);
    record("8. Store quiz results", "FAIL", "blocked by step 7");
    return printReport();
  }

  // 9-10. Roleplay
  try {
    const { ok, body } = await api("/api/roleplay/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, employeeId, trainingModuleId: moduleId }),
    });
    if (!ok) throw new Error(JSON.stringify(body));
    roleplayId = body._id;
    record("9. Start roleplay", "PASS", `session=${roleplayId}`);

    // Send messages until complete or max 5 turns
    let session = body;
    for (let i = 0; i < 5 && session.status === "active"; i++) {
      const { ok: msgOk, body: updated } = await api(`/api/roleplay/${roleplayId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "I apologize for the inconvenience. Let me help resolve this per our standard procedures.",
        }),
      });
      if (!msgOk) throw new Error(JSON.stringify(updated));
      session = updated;
      await sleep(2000);
    }

    if (session.status !== "completed" && session.status !== "evaluated") {
      // Force evaluate if conversation didn't auto-complete
      await api(`/api/roleplay/${roleplayId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Thank you for visiting. Your issue is fully resolved. Have a great day!" }),
      });
      await sleep(2000);
    }

    const { ok: evalOk, body: evaluated } = await api(`/api/roleplay/${roleplayId}/evaluate`, {
      method: "POST",
    });
    if (!evalOk || !evaluated.evaluation) throw new Error(JSON.stringify(evaluated));
    record("10. Complete roleplay", "PASS", `score=${evaluated.evaluation.overallScore}`);
  } catch (e) {
    record("9. Start roleplay", roleplayId ? "PASS" : "FAIL", roleplayId ? "" : e.message);
    record("10. Complete roleplay", "FAIL", e.message);
    return printReport();
  }

  // 11. Certification recommendation
  try {
    const { ok, body } = await api("/api/certifications/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, employeeId, trainingModuleId: moduleId }),
    });
    if (!ok) throw new Error(JSON.stringify(body));
    certId = body._id;
    record("11. Generate certification recommendation", "PASS", `id=${certId}`);
  } catch (e) {
    record("11. Generate certification recommendation", "FAIL", e.message);
    return printReport();
  }

  // 12. Manager approve
  try {
    const { ok, body } = await api(`/api/certifications/${certId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approved", managerComments: "Audit approval" }),
    });
    if (!ok || body.status !== "approved") throw new Error(JSON.stringify(body));
    record("12. Manager approve/reject", "PASS", "approved");
  } catch (e) {
    record("12. Manager approve/reject", "FAIL", e.message);
    return printReport();
  }

  // 13. Schedule recommendation
  try {
    await sleep(3000); // allow auto-schedule from cert approval
    let { body: scheds } = await api(`/api/schedules?companyId=${companyId}`);
    if (!scheds?.length) {
      const { ok, body } = await api("/api/schedules/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!ok) throw new Error(JSON.stringify(body));
      scheduleId = body._id;
    } else {
      scheduleId = scheds[0]._id;
    }
    record("13. Generate schedule recommendation", "PASS", `id=${scheduleId}`);
  } catch (e) {
    record("13. Generate schedule recommendation", "FAIL", e.message);
    return printReport();
  }

  // 14. Verify all in MongoDB
  try {
    const checks = await Promise.all([
      api(`/api/companies`),
      api(`/api/documents?companyId=${companyId}`),
      api(`/api/employees?companyId=${companyId}`),
      api(`/api/training?companyId=${companyId}&employeeId=${employeeId}`),
      api(`/api/quiz-attempts?companyId=${companyId}&employeeId=${employeeId}`),
      api(`/api/roleplay?companyId=${companyId}&employeeId=${employeeId}`),
      api(`/api/certifications?companyId=${companyId}`),
      api(`/api/schedules?companyId=${companyId}`),
    ]);
    const names = ["companies", "documents", "employees", "training", "quizAttempts", "roleplay", "certifications", "schedules"];
    const empty = names.filter((_, i) => {
      const b = checks[i].body;
      return Array.isArray(b) ? b.length === 0 : !b.modules?.length && !Object.keys(b.progress || {}).length;
    });
    if (empty.length) throw new Error(`empty collections: ${empty.join(", ")}`);
    record("14. Store all results in MongoDB", "PASS");
  } catch (e) {
    record("14. Store all results in MongoDB", "FAIL", e.message);
  }

  printReport();
}

function printReport() {
  console.log("\n=== SUMMARY ===");
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARNING").length;
  console.log(`PASS: ${pass}  FAIL: ${fail}  WARNING: ${warn}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Audit crashed:", e);
  process.exit(1);
});
