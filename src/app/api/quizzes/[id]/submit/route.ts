import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: quizId } = await params;
  const body = await request.json();
  const { companyId, employeeId, answers } = body;

  if (!companyId || !employeeId || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "companyId, employeeId, and answers are required" },
      { status: 400 }
    );
  }

  const collections = await getCollections();
  const quiz = await collections.quizzes.findOne({ _id: toObjectId(quizId) });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const progress = await collections.employeeTrainingProgress.findOne({
    companyId: toObjectId(companyId),
    employeeId: toObjectId(employeeId),
    trainingModuleId: quiz.trainingModuleId,
    status: "completed",
  });

  if (!progress) {
    return NextResponse.json(
      { error: "Complete training before taking the quiz" },
      { status: 400 }
    );
  }

  const scoredAnswers = answers.map(
    (a: { questionId: string; answer: string }) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      const isCorrect =
        question?.correctAnswer.trim().toLowerCase() ===
        a.answer.trim().toLowerCase();
      return {
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: !!isCorrect,
      };
    }
  );

  const correctCount = scoredAnswers.filter((a) => a.isCorrect).length;
  const score = Math.round((correctCount / quiz.questions.length) * 100);
  const passed = score >= quiz.passingScore;
  const now = new Date();

  const result = await collections.quizAttempts.insertOne({
    companyId: toObjectId(companyId),
    employeeId: toObjectId(employeeId),
    quizId: toObjectId(quizId),
    trainingModuleId: quiz.trainingModuleId,
    answers: scoredAnswers,
    score,
    passed,
    completedAt: now,
    createdAt: now,
  });

  const attempt = await collections.quizAttempts.findOne({
    _id: result.insertedId,
  });

  return NextResponse.json(serialize(attempt), { status: 201 });
}
