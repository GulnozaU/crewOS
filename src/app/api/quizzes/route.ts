import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const trainingModuleId = request.nextUrl.searchParams.get("trainingModuleId");
  const companyId = request.nextUrl.searchParams.get("companyId");

  const collections = await getCollections();
  const filter: Record<string, unknown> = {};

  if (trainingModuleId) filter.trainingModuleId = toObjectId(trainingModuleId);
  if (companyId) filter.companyId = toObjectId(companyId);

  if (Object.keys(filter).length === 0) {
    return NextResponse.json(
      { error: "trainingModuleId or companyId required" },
      { status: 400 }
    );
  }

  const quizzes = await collections.quizzes.find(filter).toArray();

  const sanitized = quizzes.map((quiz) => ({
    ...serialize(quiz),
    questions: quiz.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    })),
  }));

  return NextResponse.json(sanitized);
}
