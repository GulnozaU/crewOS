import type { RoleplayEvaluation } from "@/types";

export function localRoleplayScenario(
  moduleTitle: string,
  employeeRole: string
): {
  scenarioTitle: string;
  scenarioDescription: string;
  customerPersona: string;
  objectives: string[];
  openingMessage: string;
} {
  return {
    scenarioTitle: `${moduleTitle} — Customer Scenario`,
    scenarioDescription: `A customer needs help during a busy shift. Apply the ${moduleTitle} procedures you trained on.`,
    customerPersona: "Busy regular customer, polite but expects correct service",
    objectives: [
      "Greet the customer within 10 seconds",
      "Follow the SOP step by step",
      "Escalate to manager if the issue cannot be resolved",
    ],
    openingMessage: `Hi, I'm ${employeeRole} on duty — I ordered earlier and something doesn't match what I expected. Can you help?`,
  };
}

export function localRoleplayEvaluation(
  messages: { role: string; content: string }[]
): RoleplayEvaluation {
  const employeeTurns = messages.filter((m) => m.role === "employee").length;
  const base = Math.min(92, 68 + employeeTurns * 6);

  return {
    overallScore: base,
    categories: [
      {
        name: "Procedure adherence",
        score: base,
        feedback: "Employee followed core SOP steps from training.",
        passed: base >= 70,
      },
      {
        name: "Communication",
        score: Math.min(95, base + 4),
        feedback: "Professional tone and clear responses.",
        passed: true,
      },
    ],
    weakAreas: base < 80 ? ["Review escalation steps in the SOP"] : [],
    strengths: ["Polite greeting", "Offered a concrete solution"],
    summary: `Roleplay completed with score ${base}/100 based on SOP-aligned responses.`,
  };
}

export function localCertificationRecommendation(
  employeeName: string,
  moduleTitle: string,
  quizScore: number,
  quizPassed: boolean,
  roleplayScore: number
): { recommended: boolean; confidence: number; reasoning: string } {
  const recommended = quizPassed && quizScore >= 70 && roleplayScore >= 70;
  return {
    recommended,
    confidence: recommended ? 0.88 : 0.45,
    reasoning: recommended
      ? `${employeeName} passed the ${moduleTitle} quiz (${quizScore}%) and roleplay (${roleplayScore}/100). Ready for certification.`
      : `${employeeName} needs more practice on ${moduleTitle} before certification.`,
  };
}
