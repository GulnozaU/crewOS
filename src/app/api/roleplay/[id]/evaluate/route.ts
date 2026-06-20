import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { localRoleplayEvaluation } from "@/lib/demo-fallbacks";
import { evaluateRoleplay } from "@/lib/gemini";
import { recordRoleplayWeaknesses } from "@/lib/workflows";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const collections = await getCollections();

  const session = await collections.roleplaySessions.findOne({
    _id: toObjectId(sessionId),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "evaluated" && session.evaluation) {
    return NextResponse.json(serialize(session));
  }

  if (session.status !== "completed" && session.status !== "evaluated") {
    return NextResponse.json(
      { error: "Complete the roleplay conversation before evaluation" },
      { status: 400 }
    );
  }

  const trainingModule = await collections.trainingModules.findOne({
    _id: session.trainingModuleId,
  });
  const doc = trainingModule
    ? await collections.documents.findOne({ _id: trainingModule.documentId })
    : null;
  const documentContext = doc?.extractedText || doc?.summary || "";

  const history = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let evaluation;
  try {
    evaluation = await evaluateRoleplay(
      session.scenarioDescription,
      session.objectives,
      documentContext,
      history
    );
  } catch {
    evaluation = localRoleplayEvaluation(history);
  }

  await collections.roleplaySessions.updateOne(
    { _id: toObjectId(sessionId) },
    {
      $set: {
        evaluation,
        status: "evaluated",
        updatedAt: new Date(),
      },
    }
  );

  await recordRoleplayWeaknesses(
    session.companyId,
    session.employeeId,
    evaluation.weakAreas,
    evaluation.categories
  );

  const updated = await collections.roleplaySessions.findOne({
    _id: toObjectId(sessionId),
  });

  return NextResponse.json(serialize(updated));
}
