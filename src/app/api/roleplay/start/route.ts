import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { localRoleplayScenario } from "@/lib/demo-fallbacks";
import { generateRoleplayScenario } from "@/lib/gemini";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, employeeId, trainingModuleId } = body;

  if (!companyId || !employeeId || !trainingModuleId) {
    return NextResponse.json(
      { error: "companyId, employeeId, and trainingModuleId are required" },
      { status: 400 }
    );
  }

  const collections = await getCollections();

  const employee = await collections.employees.findOne({
    _id: toObjectId(employeeId),
  });
  const trainingModule = await collections.trainingModules.findOne({
    _id: toObjectId(trainingModuleId),
  });
  if (!employee || !trainingModule) {
    return NextResponse.json({ error: "Employee or module not found" }, { status: 404 });
  }

  const quizAttempt = await collections.quizAttempts.findOne({
    companyId: toObjectId(companyId),
    employeeId: toObjectId(employeeId),
    trainingModuleId: toObjectId(trainingModuleId),
    passed: true,
  });

  if (!quizAttempt) {
    return NextResponse.json(
      { error: "Pass the quiz before starting roleplay" },
      { status: 400 }
    );
  }

  const doc = await collections.documents.findOne({ _id: trainingModule.documentId });
  const documentText = doc?.extractedText || doc?.summary || "";

  let scenario;
  try {
    scenario = await generateRoleplayScenario(
      documentText,
      trainingModule.title,
      employee.role
    );
  } catch {
    scenario = localRoleplayScenario(trainingModule.title, employee.role);
  }

  const now = new Date();
  const result = await collections.roleplaySessions.insertOne({
    companyId: toObjectId(companyId),
    employeeId: toObjectId(employeeId),
    trainingModuleId: toObjectId(trainingModuleId),
    scenarioTitle: scenario.scenarioTitle,
    scenarioDescription: scenario.scenarioDescription,
    customerPersona: scenario.customerPersona,
    objectives: scenario.objectives,
    messages: [
      {
        role: "customer",
        content: scenario.openingMessage,
        timestamp: now,
      },
    ],
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const session = await collections.roleplaySessions.findOne({
    _id: result.insertedId,
  });

  return NextResponse.json(serialize(session), { status: 201 });
}
