import type { QuizQuestion, TrainingSection } from "@/types";

export interface ParsedSopTraining {
  title: string;
  description: string;
  sections: TrainingSection[];
  estimatedMinutes: number;
  quiz: {
    title: string;
    questions: QuizQuestion[];
    passingScore: number;
  };
}

const DISTRACTORS = [
  "Ignore the procedure and continue serving",
  "Skip manager notification",
  "No documentation or checklist required",
  "Close the store early without approval",
];

export function parseSopTraining(text: string, fileName: string): ParsedSopTraining {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const titleLine = lines[0] || fileName;
  const title =
    titleLine
      .replace(/^SUNRISE COFFEE CO\.\s*[—-]\s*/i, "")
      .replace(/\s*SOP.*$/i, "")
      .trim() || fileName.replace(/\.txt$/i, "");

  const purposeIdx = lines.findIndex((l) => l.toUpperCase() === "PURPOSE");
  const description =
    purposeIdx >= 0 && lines[purposeIdx + 1]
      ? lines[purposeIdx + 1]
      : `Training generated from ${fileName}`;

  const sections: { title: string; content: string; keyPoints: string[] }[] = [];
  let current: { title: string; content: string; keyPoints: string[] } | null = null;

  for (const line of lines) {
    const isHeader =
      line === line.toUpperCase() &&
      line.length > 3 &&
      line.length < 60 &&
      !line.startsWith("-") &&
      !/^\d+\./.test(line) &&
      !line.includes("Document ID");

    if (isHeader && !["PURPOSE", "NON-COMPLIANCE"].includes(line)) {
      if (current && (current.content || current.keyPoints.length)) sections.push(current);
      current = { title: line, content: "", keyPoints: [] };
      continue;
    }

    if (!current) current = { title: "Overview", content: "", keyPoints: [] };

    if (line.startsWith("-")) {
      current.keyPoints.push(line.replace(/^-\s*/, ""));
    } else if (/^\d+\./.test(line)) {
      current.content += (current.content ? "\n" : "") + line;
      current.keyPoints.push(line.replace(/^\d+\.\s*/, ""));
    } else if (line.toUpperCase() !== "PURPOSE") {
      current.content += (current.content ? "\n" : "") + line;
    }
  }
  if (current && (current.content || current.keyPoints.length)) sections.push(current);

  const cleaned: TrainingSection[] = sections
    .filter((s) => s.content || s.keyPoints.length)
    .slice(0, 6)
    .map((s) => ({
      title: s.title,
      content: s.content || s.keyPoints.join("\n"),
      keyPoints: s.keyPoints.slice(0, 5),
    }));

  if (!cleaned.length) {
    cleaned.push({
      title: "Procedure",
      content: text.slice(0, 1200),
      keyPoints: lines.filter((l) => l.startsWith("-")).map((l) => l.slice(2)).slice(0, 5),
    });
  }

  const questions: QuizQuestion[] = cleaned
    .flatMap((s) => s.keyPoints.slice(0, 2).map((point) => ({ section: s.title, point })))
    .filter((x) => x.point)
    .slice(0, 5)
    .map(({ section, point }, i) => {
      const correct = point.length > 100 ? point.slice(0, 97) + "..." : point;
      return {
        id: `q${i + 1}`,
        question: `[${section}] Which action follows the SOP?`,
        options: [
          correct,
          DISTRACTORS[i % DISTRACTORS.length],
          DISTRACTORS[(i + 1) % DISTRACTORS.length],
          DISTRACTORS[(i + 2) % DISTRACTORS.length],
        ],
        correctAnswer: correct,
        explanation: `Per the SOP: ${point}`,
      };
    });

  if (questions.length < 3) {
    questions.push({
      id: "q-fallback",
      question: `What is the main purpose of the ${title} SOP?`,
      options: [description, "Reduce customer visits", "Skip safety checks", "Close early"],
      correctAnswer: description,
      explanation: description,
    });
  }

  return {
    title,
    description,
    sections: cleaned,
    estimatedMinutes: Math.max(5, Math.min(20, cleaned.length * 4)),
    quiz: {
      title: `${title} — Knowledge Check`,
      questions,
      passingScore: 70,
    },
  };
}

export function summarizeSopLocally(text: string): string {
  const purposeIdx = text.split("\n").findIndex((l) => l.trim().toUpperCase() === "PURPOSE");
  if (purposeIdx >= 0) {
    const next = text
      .split("\n")
      .slice(purposeIdx + 1)
      .find((l) => l.trim());
    if (next) return next.trim();
  }
  return text.split("\n").find((l) => l.trim().length > 20)?.trim() || "Company SOP document";
}
