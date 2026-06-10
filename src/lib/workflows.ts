import { ObjectId } from "mongodb";
import { getCollections } from "./db";
import {
  summarizeDocument,
  generateTrainingModule,
  generateQuiz,
  generateSupplementalTraining,
  generateScheduleRecommendation,
} from "./gemini";
import { extractTextFromFile } from "./documents";
import type { ScheduleRecommendation } from "@/types";

export async function processDocument(documentId: string): Promise<void> {
  const collections = await getCollections();
  const docId = new ObjectId(documentId);

  const doc = await collections.documents.findOne({ _id: docId });
  if (!doc) throw new Error("Document not found");

  await collections.documents.updateOne(
    { _id: docId },
    { $set: { status: "processing", updatedAt: new Date() } }
  );

  try {
    const extractedText = await extractTextFromFile(doc.filePath, doc.mimeType);
    if (!extractedText.trim()) {
      throw new Error("No text could be extracted from document");
    }

    const summary = await summarizeDocument(extractedText);

    await collections.documents.updateOne(
      { _id: docId },
      {
        $set: {
          extractedText,
          summary,
          status: "processed",
          updatedAt: new Date(),
        },
      }
    );

    await generateTrainingFromDocument(docId, doc.companyId, extractedText, doc.originalName);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await collections.documents.updateOne(
      { _id: docId },
      {
        $set: {
          status: "failed",
          processingError: message,
          updatedAt: new Date(),
        },
      }
    );
    throw error;
  }
}

async function generateTrainingFromDocument(
  documentId: ObjectId,
  companyId: ObjectId,
  text: string,
  documentName: string
): Promise<void> {
  const collections = await getCollections();

  const moduleData = await generateTrainingModule(text, documentName);
  const now = new Date();

  const trainingResult = await collections.trainingModules.insertOne({
    companyId,
    documentId,
    title: moduleData.title,
    description: moduleData.description,
    sections: moduleData.sections,
    estimatedMinutes: moduleData.estimatedMinutes,
    createdAt: now,
    updatedAt: now,
  });

  const quizData = await generateQuiz(moduleData.title, moduleData.sections);

  await collections.quizzes.insertOne({
    companyId,
    trainingModuleId: trainingResult.insertedId,
    title: quizData.title,
    questions: quizData.questions,
    passingScore: quizData.passingScore,
    createdAt: now,
    updatedAt: now,
  });

  const employees = await collections.employees
    .find({ companyId })
    .toArray();

  if (employees.length > 0) {
    await collections.employeeTrainingProgress.insertMany(
      employees.map((emp) => ({
        companyId,
        employeeId: emp._id!,
        trainingModuleId: trainingResult.insertedId,
        status: "assigned" as const,
        completedSections: [],
        createdAt: now,
        updatedAt: now,
      }))
    );
  }
}

export async function recordRoleplayWeaknesses(
  companyId: ObjectId,
  employeeId: ObjectId,
  weakAreas: string[],
  categories: { name: string; passed: boolean }[]
): Promise<void> {
  const collections = await getCollections();
  const now = new Date();

  const failedCategories = categories.filter((c) => !c.passed).map((c) => c.name);
  const allWeaknesses = [...new Set([...weakAreas, ...failedCategories])];

  for (const topic of allWeaknesses) {
    const existing = await collections.roleplayWeaknesses.findOne({
      companyId,
      employeeId,
      topic,
    });

    if (existing) {
      await collections.roleplayWeaknesses.updateOne(
        { _id: existing._id },
        {
          $inc: { occurrenceCount: 1 },
          $set: { lastSeenAt: now, updatedAt: now },
        }
      );
    } else {
      await collections.roleplayWeaknesses.insertOne({
        companyId,
        employeeId,
        category: "roleplay",
        topic,
        occurrenceCount: 1,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const topWeaknesses = await collections.roleplayWeaknesses
    .find({ companyId, employeeId })
    .sort({ occurrenceCount: -1 })
    .limit(3)
    .toArray();

  if (topWeaknesses.length === 0) return;

  const employee = await collections.employees.findOne({ _id: employeeId });
  if (!employee) return;

  const docs = await collections.documents
    .find({ companyId, status: "processed" })
    .toArray();
  const documentContext = docs
    .map((d) => d.extractedText || d.summary || "")
    .join("\n\n");

  if (!documentContext.trim()) return;

  const weakTopics = topWeaknesses.map((w) => w.topic);
  const supplemental = await generateSupplementalTraining(
    weakTopics,
    documentContext,
    employee.role
  );

  await collections.supplementalTraining.insertOne({
    companyId,
    employeeId,
    weaknessId: topWeaknesses[0]._id!,
    title: supplemental.title,
    content: supplemental.content,
    sourceWeakAreas: weakTopics,
    createdAt: now,
  });
}

export async function getCompanyKnowledgeContext(companyId: ObjectId): Promise<string> {
  const collections = await getCollections();

  const docs = await collections.documents
    .find({ companyId, status: "processed" })
    .toArray();

  const modules = await collections.trainingModules
    .find({ companyId })
    .toArray();

  const supplemental = await collections.supplementalTraining
    .find({ companyId })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  const parts: string[] = [];

  for (const doc of docs) {
    if (doc.summary) parts.push(`Document: ${doc.originalName}\n${doc.summary}`);
    if (doc.extractedText) {
      parts.push(doc.extractedText.slice(0, 5000));
    }
  }

  for (const mod of modules) {
    parts.push(
      `Training: ${mod.title}\n${mod.sections.map((s) => `${s.title}: ${s.content}`).join("\n")}`
    );
  }

  for (const sup of supplemental) {
    parts.push(`Supplemental Training: ${sup.title}\n${sup.content}`);
  }

  return parts.join("\n\n---\n\n");
}

export async function getHistoricalManagerFeedback(companyId: ObjectId) {
  const collections = await getCollections();
  return collections.managerFeedback
    .find({ companyId })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
}

export async function createScheduleRecommendation(
  companyId: ObjectId,
  weekStartDate?: string
): Promise<ScheduleRecommendation> {
  const collections = await getCollections();

  const employees = await collections.employees.find({ companyId }).toArray();
  if (employees.length === 0) {
    throw new Error("Add employees before generating a schedule");
  }

  const approvedCerts = await collections.certificationRecommendations
    .find({ companyId, status: "approved" })
    .toArray();

  if (approvedCerts.length === 0) {
    throw new Error(
      "Approve at least one certification recommendation before generating a schedule"
    );
  }

  const approvedWithDetails = await Promise.all(
    approvedCerts.map(async (cert) => {
      const emp = employees.find((e) => e._id?.equals(cert.employeeId));
      const mod = await collections.trainingModules.findOne({
        _id: cert.trainingModuleId,
      });
      return {
        employeeName: emp?.name || "Unknown",
        role: emp?.role || "Unknown",
        moduleTitle: mod?.title || "Unknown",
      };
    })
  );

  const scheduleFeedback = (await getHistoricalManagerFeedback(companyId)).filter(
    (f) => f.recommendationType === "schedule"
  );

  const startDate = weekStartDate || new Date().toISOString().split("T")[0];

  const schedule = await generateScheduleRecommendation(
    employees,
    approvedWithDetails,
    scheduleFeedback,
    startDate
  );

  const now = new Date();
  const result = await collections.scheduleRecommendations.insertOne({
    companyId,
    weekStartDate: startDate,
    shifts: schedule.shifts,
    reasoning: schedule.reasoning,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const record = await collections.scheduleRecommendations.findOne({
    _id: result.insertedId,
  });

  if (!record) {
    throw new Error("Failed to create schedule recommendation");
  }

  return record;
}
