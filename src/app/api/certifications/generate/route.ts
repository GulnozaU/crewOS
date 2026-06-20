import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { localCertificationRecommendation } from "@/lib/demo-fallbacks";
import { generateCertificationRecommendation } from "@/lib/gemini";
import { getHistoricalManagerFeedback } from "@/lib/workflows";
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

  const quizAttempt = await collections.quizAttempts.findOne(
    {
      companyId: toObjectId(companyId),
      employeeId: toObjectId(employeeId),
      trainingModuleId: toObjectId(trainingModuleId),
    },
    { sort: { createdAt: -1 } }
  );

  if (!quizAttempt) {
    return NextResponse.json({ error: "No quiz attempt found" }, { status: 400 });
  }

  const roleplaySession = await collections.roleplaySessions.findOne(
    {
      companyId: toObjectId(companyId),
      employeeId: toObjectId(employeeId),
      trainingModuleId: toObjectId(trainingModuleId),
      status: "evaluated",
    },
    { sort: { createdAt: -1 } }
  );

  if (!roleplaySession?.evaluation) {
    return NextResponse.json(
      { error: "Complete and evaluate roleplay first" },
      { status: 400 }
    );
  }

  const historicalFeedback = await getHistoricalManagerFeedback(
    toObjectId(companyId)
  );

  let recommendation;
  try {
    recommendation = await generateCertificationRecommendation(
      employee.name,
      employee.role,
      trainingModule.title,
      quizAttempt.score,
      quizAttempt.passed,
      roleplaySession.evaluation,
      historicalFeedback
    );
  } catch {
    recommendation = localCertificationRecommendation(
      employee.name,
      trainingModule.title,
      quizAttempt.score,
      quizAttempt.passed,
      roleplaySession.evaluation.overallScore
    );
  }

  const now = new Date();
  const result = await collections.certificationRecommendations.insertOne({
    companyId: toObjectId(companyId),
    employeeId: toObjectId(employeeId),
    trainingModuleId: toObjectId(trainingModuleId),
    quizAttemptId: quizAttempt._id,
    roleplaySessionId: roleplaySession._id,
    recommended: recommendation.recommended,
    confidence: recommendation.confidence,
    reasoning: recommendation.reasoning,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const record = await collections.certificationRecommendations.findOne({
    _id: result.insertedId,
  });

  return NextResponse.json(serialize(record), { status: 201 });
}
