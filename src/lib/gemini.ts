import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  TrainingSection,
  QuizQuestion,
  RoleplayEvaluation,
  ManagerFeedback,
  ScheduleShift,
  Employee,
} from "@/types";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenerativeAI(apiKey);
}

function getModel() {
  return getClient().getGenerativeModel({ model: MODEL });
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1)) as T;
    }
    const arrStart = raw.indexOf("[");
    const arrEnd = raw.lastIndexOf("]");
    if (arrStart >= 0 && arrEnd > arrStart) {
      return JSON.parse(raw.slice(arrStart, arrEnd + 1)) as T;
    }
    throw new Error(`Failed to parse Gemini JSON response: ${text.slice(0, 200)}`);
  }
}

export async function summarizeDocument(text: string): Promise<string> {
  const model = getModel();
  const result = await model.generateContent(
    `Summarize this business document for training purposes. Focus on operational procedures, policies, and key knowledge employees must learn.\n\nDocument:\n${text.slice(0, 30000)}`
  );
  return result.response.text();
}

export async function generateTrainingModule(
  documentText: string,
  documentName: string
): Promise<{
  title: string;
  description: string;
  sections: TrainingSection[];
  estimatedMinutes: number;
}> {
  const model = getModel();
  const prompt = `You are an expert corporate trainer. Based ONLY on the following company document, create a structured training module.

Document name: ${documentName}

Document content:
${documentText.slice(0, 25000)}

Return valid JSON with this exact structure:
{
  "title": "module title",
  "description": "brief description",
  "estimatedMinutes": 30,
  "sections": [
    {
      "title": "section title",
      "content": "detailed training content in paragraphs",
      "keyPoints": ["point 1", "point 2"]
    }
  ]
}

Create 3-5 sections covering the most important operational knowledge from the document. All content must be derived from the document.`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function generateQuiz(
  moduleTitle: string,
  sections: TrainingSection[]
): Promise<{
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}> {
  const model = getModel();
  const content = sections
    .map((s) => `## ${s.title}\n${s.content}\nKey points: ${s.keyPoints.join(", ")}`)
    .join("\n\n");

  const prompt = `Create a quiz based ONLY on this training module content.

Module: ${moduleTitle}

Content:
${content.slice(0, 20000)}

Return valid JSON:
{
  "title": "quiz title",
  "passingScore": 70,
  "questions": [
    {
      "id": "q1",
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "exact text of correct option",
      "explanation": "why this is correct based on training content"
    }
  ]
}

Create 5-8 multiple choice questions. correctAnswer must exactly match one of the options.`;

  const result = await model.generateContent(prompt);
  const parsed = extractJson<{
    title: string;
    questions: QuizQuestion[];
    passingScore: number;
  }>(result.response.text());

  parsed.questions = parsed.questions.map((q, i) => ({
    ...q,
    id: q.id || `q${i + 1}`,
  }));

  return parsed;
}

export async function generateRoleplayScenario(
  documentText: string,
  moduleTitle: string,
  employeeRole: string
): Promise<{
  scenarioTitle: string;
  scenarioDescription: string;
  customerPersona: string;
  objectives: string[];
  openingMessage: string;
}> {
  const model = getModel();
  const prompt = `Create a realistic customer interaction roleplay scenario based on the company's procedures and the training module.

Employee role: ${employeeRole}
Training module: ${moduleTitle}

Company document context:
${documentText.slice(0, 15000)}

Return valid JSON:
{
  "scenarioTitle": "title",
  "scenarioDescription": "what the employee must handle",
  "customerPersona": "who the customer is and their mood/needs",
  "objectives": ["objective 1", "objective 2"],
  "openingMessage": "first message from the customer to start the roleplay"
}

The scenario must test knowledge from the company documents.`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function generateCustomerResponse(
  scenarioDescription: string,
  customerPersona: string,
  conversationHistory: { role: string; content: string }[],
  employeeMessage: string
): Promise<{ response: string; isComplete: boolean }> {
  const model = getModel();
  const history = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `You are roleplaying as a customer in a training simulation.

Scenario: ${scenarioDescription}
Customer persona: ${customerPersona}

Conversation so far:
${history}

Employee just said: ${employeeMessage}

Respond as the customer. Stay in character. If the employee has successfully resolved the situation per standard procedures, set isComplete to true.

Return valid JSON:
{
  "response": "customer's next message",
  "isComplete": false
}`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function evaluateRoleplay(
  scenarioDescription: string,
  objectives: string[],
  documentContext: string,
  conversationHistory: { role: string; content: string }[]
): Promise<RoleplayEvaluation> {
  const model = getModel();
  const history = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `Evaluate this employee roleplay against company procedures and scenario objectives.

Scenario: ${scenarioDescription}
Objectives: ${objectives.join(", ")}

Company procedures context:
${documentContext.slice(0, 10000)}

Conversation:
${history}

Return valid JSON:
{
  "overallScore": 85,
  "categories": [
    {
      "name": "category name",
      "score": 80,
      "feedback": "specific feedback",
      "passed": true
    }
  ],
  "weakAreas": ["specific weak topic 1"],
  "strengths": ["strength 1"],
  "summary": "overall evaluation summary"
}

Score 0-100. Include 3-5 evaluation categories. weakAreas must be specific knowledge gaps.`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function generateCertificationRecommendation(
  employeeName: string,
  employeeRole: string,
  moduleTitle: string,
  quizScore: number,
  quizPassed: boolean,
  roleplayEvaluation: RoleplayEvaluation,
  historicalFeedback: ManagerFeedback[]
): Promise<{
  recommended: boolean;
  confidence: number;
  reasoning: string;
}> {
  const model = getModel();
  const feedbackContext =
    historicalFeedback.length > 0
      ? `\nHistorical manager decisions (learn from these patterns):\n${historicalFeedback
          .map(
            (f) =>
              `- Type: ${f.recommendationType}, Decision: ${f.decision}, Comments: ${f.managerComments}, Original: ${f.originalRecommendation}`
          )
          .join("\n")}`
      : "";

  const prompt = `As an AI workforce manager, recommend whether to certify this employee.

Employee: ${employeeName} (${employeeRole})
Training module: ${moduleTitle}
Quiz score: ${quizScore}% (passed: ${quizPassed})
Roleplay overall score: ${roleplayEvaluation.overallScore}
Roleplay weak areas: ${roleplayEvaluation.weakAreas.join(", ")}
Roleplay strengths: ${roleplayEvaluation.strengths.join(", ")}
${feedbackContext}

Return valid JSON:
{
  "recommended": true,
  "confidence": 0.85,
  "reasoning": "detailed reasoning citing specific performance data"
}

Base your recommendation on actual performance data. Consider historical manager feedback patterns when available.`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function generateScheduleRecommendation(
  employees: Employee[],
  approvedCertifications: { employeeName: string; role: string; moduleTitle: string }[],
  historicalFeedback: ManagerFeedback[],
  weekStartDate: string
): Promise<{
  shifts: ScheduleShift[];
  reasoning: string;
}> {
  const model = getModel();
  const employeeList = employees
    .map((e) => `- ${e.name} (${e.role}, id: ${e._id?.toString()})`)
    .join("\n");

  const certList =
    approvedCertifications.length > 0
      ? approvedCertifications
          .map((c) => `- ${c.employeeName}: certified in ${c.moduleTitle}`)
          .join("\n")
      : "No certifications approved yet";

  const feedbackContext =
    historicalFeedback.length > 0
      ? `\nHistorical schedule feedback:\n${historicalFeedback
          .map((f) => `- Decision: ${f.decision}, Comments: ${f.managerComments}`)
          .join("\n")}`
      : "";

  const prompt = `Create a weekly work schedule for a small business.

Week starting: ${weekStartDate}

Employees:
${employeeList}

Certified employees:
${certList}
${feedbackContext}

Return valid JSON:
{
  "reasoning": "why this schedule was designed this way",
  "shifts": [
    {
      "employeeId": "employee mongo id string",
      "employeeName": "name",
      "day": "Monday",
      "startTime": "09:00",
      "endTime": "17:00",
      "role": "role during shift",
      "notes": "optional notes"
    }
  ]
}

Create realistic shifts Mon-Sun. Prioritize certified employees for roles matching their training. Use actual employee IDs from the list.`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function generateSupplementalTraining(
  weakAreas: string[],
  documentContext: string,
  employeeRole: string
): Promise<{ title: string; content: string }> {
  const model = getModel();
  const prompt = `Create supplemental training content to address these knowledge gaps for a ${employeeRole}.

Weak areas: ${weakAreas.join(", ")}

Company document context:
${documentContext.slice(0, 15000)}

Return valid JSON:
{
  "title": "training title targeting weak areas",
  "content": "detailed training content in markdown format"
}

Content must be derived from company documents and directly address the weak areas.`;

  const result = await model.generateContent(prompt);
  return extractJson(result.response.text());
}

export async function scoreQuizAnswers(
  moduleTitle: string,
  sections: TrainingSection[],
  questions: QuizQuestion[],
  answers: { questionId: string; answer: string }[]
): Promise<{
  scoredAnswers: { questionId: string; answer: string; isCorrect: boolean }[];
  score: number;
}> {
  const model = getModel();
  const content = sections
    .map((s) => `## ${s.title}\n${s.content}\nKey points: ${s.keyPoints.join(", ")}`)
    .join("\n\n");

  const answerMap = Object.fromEntries(answers.map((a) => [a.questionId, a.answer]));

  const prompt = `You are grading a training quiz. Score each employee answer against the training module content ONLY.

Module: ${moduleTitle}

Training content:
${content.slice(0, 20000)}

Questions and employee answers:
${questions
  .map((q) => {
    const employeeAnswer = answerMap[q.id] || "(no answer)";
    return `ID: ${q.id}
Question: ${q.question}
Options: ${q.options.join(" | ")}
Reference correct answer: ${q.correctAnswer}
Employee answer: ${employeeAnswer}`;
  })
  .join("\n\n")}

Return valid JSON:
{
  "results": [
    {
      "questionId": "q1",
      "isCorrect": true,
      "reasoning": "brief reason based on training content"
    }
  ]
}

Mark isCorrect true only if the employee answer demonstrates correct understanding per the training content. Accept paraphrased correct answers.`;

  const result = await model.generateContent(prompt);
  const parsed = extractJson<{
    results: { questionId: string; isCorrect: boolean }[];
  }>(result.response.text());

  const resultMap = Object.fromEntries(
    parsed.results.map((r) => [r.questionId, r.isCorrect])
  );

  const scoredAnswers = answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer,
    isCorrect: resultMap[a.questionId] ?? false,
  }));

  const correctCount = scoredAnswers.filter((a) => a.isCorrect).length;
  const score = Math.round((correctCount / questions.length) * 100);

  return { scoredAnswers, score };
}

export async function chatWithManager(
  companyContext: string,
  employeeName: string,
  employeeRole: string,
  message: string,
  chatHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const model = getModel();
  const history = chatHistory
    .map((m) => `${m.role === "user" ? "Employee" : "AI Manager"}: ${m.content}`)
    .join("\n");

  const prompt = `You are an AI manager assistant for a small business. Answer employee questions using ONLY the company knowledge below. If you don't know, say so.

Employee: ${employeeName} (${employeeRole})

Company knowledge:
${companyContext.slice(0, 20000)}

Previous conversation:
${history}

Employee question: ${message}

Provide a helpful, professional response based on company procedures.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
