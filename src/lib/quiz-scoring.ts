import type { QuizQuestion, TrainingSection } from "@/types";

export function scoreQuizLocally(
  questions: QuizQuestion[],
  answers: { questionId: string; answer: string }[]
): {
  scoredAnswers: { questionId: string; answer: string; isCorrect: boolean }[];
  score: number;
} {
  const answerMap = Object.fromEntries(answers.map((a) => [a.questionId, a.answer]));

  const scoredAnswers = questions.map((q) => {
    const answer = answerMap[q.id] || "";
    const isCorrect =
      answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() ||
      q.options[0]?.trim().toLowerCase() === answer.trim().toLowerCase();
    return { questionId: q.id, answer, isCorrect };
  });

  const correctCount = scoredAnswers.filter((a) => a.isCorrect).length;
  const score =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  return { scoredAnswers, score };
}

export function canScoreQuizLocally(questions: QuizQuestion[]): boolean {
  return (
    questions.length > 0 &&
    questions.every((q) => Boolean(q.correctAnswer?.trim()) && q.options.length >= 2)
  );
}

/** Prefer instant local grading for demo SOP quizzes; Gemini optional for open-ended flows. */
export async function scoreQuiz(
  moduleTitle: string,
  sections: TrainingSection[],
  questions: QuizQuestion[],
  answers: { questionId: string; answer: string }[],
  geminiScorer: () => Promise<{
    scoredAnswers: { questionId: string; answer: string; isCorrect: boolean }[];
    score: number;
  }>
): Promise<{
  scoredAnswers: { questionId: string; answer: string; isCorrect: boolean }[];
  score: number;
}> {
  if (canScoreQuizLocally(questions)) {
    return scoreQuizLocally(questions, answers);
  }
  return geminiScorer();
}
