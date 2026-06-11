/**
 * Seed Sunrise Coffee Co. demo data directly into MongoDB.
 * Real records in Atlas — not hardcoded in the app UI.
 *
 * Usage: node scripts/seed-sunrise.mjs
 *        npm run seed:sunrise
 */
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { MongoClient, ObjectId } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOPS_DIR = join(ROOT, "samples", "sops");

const COMPANY_NAME = "Sunrise Coffee Co.";
const COMPANY_INDUSTRY = "Food & Beverage";

const EMPLOYEES = [
  { name: "Alex Rivera", email: "alex@sunrisecoffee.demo", role: "Barista" },
  { name: "Jordan Lee", email: "jordan@sunrisecoffee.demo", role: "Shift Lead" },
  { name: "Sam Patel", email: "sam@sunrisecoffee.demo", role: "Manager" },
];

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return env;
}

function parseSopTraining(text, fileName) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = lines[0] || fileName;
  const title = titleLine
    .replace(/^SUNRISE COFFEE CO\.\s*[—-]\s*/i, "")
    .replace(/\s*SOP.*$/i, "")
    .trim() || basename(fileName, ".txt");

  const purposeIdx = lines.findIndex((l) => l.toUpperCase() === "PURPOSE");
  const description =
    purposeIdx >= 0 && lines[purposeIdx + 1]
      ? lines[purposeIdx + 1]
      : `Training from ${fileName}`;

  const sections = [];
  let current = null;

  for (const line of lines) {
    const isHeader =
      line === line.toUpperCase() &&
      line.length > 3 &&
      line.length < 60 &&
      !line.startsWith("-") &&
      !/^\d+\./.test(line) &&
      !line.includes("Document ID");

    if (isHeader && !["PURPOSE", "NON-COMPLIANCE"].includes(line)) {
      if (current?.content.length) sections.push(current);
      current = { title: line, content: "", keyPoints: [] };
      continue;
    }

    if (!current) {
      current = { title: "Overview", content: "", keyPoints: [] };
    }

    if (line.startsWith("-")) {
      current.keyPoints.push(line.replace(/^-\s*/, ""));
    } else if (/^\d+\./.test(line)) {
      current.content += (current.content ? "\n" : "") + line;
      current.keyPoints.push(line.replace(/^\d+\.\s*/, ""));
    } else if (line.toUpperCase() !== "PURPOSE") {
      current.content += (current.content ? "\n" : "") + line;
    }
  }
  if (current?.content.length || current?.keyPoints.length) sections.push(current);

  const cleaned = sections
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

  const questions = cleaned
    .flatMap((s) => s.keyPoints.slice(0, 2))
    .filter(Boolean)
    .slice(0, 5)
    .map((point, i) => {
      const correct = point.length > 80 ? point.slice(0, 77) + "..." : point;
      return {
        id: `q${i + 1}`,
        question: `Which statement is correct for ${title}?`,
        options: [correct, "Ignore the procedure", "Skip manager notification", "No documentation required"],
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

async function main() {
  const { MONGODB_URI, MONGODB_DB = "crewoz" } = loadEnv();
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in .env.local");
    process.exit(1);
  }
  if (MONGODB_URI === "memory") {
    console.error("Cannot seed memory DB from this script. Use Atlas URI in .env.local.");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15_000, family: 4 });
  await client.connect();
  const db = client.db(MONGODB_DB);

  const companies = db.collection("companies");
  const employees = db.collection("employees");
  const documents = db.collection("documents");
  const trainingModules = db.collection("trainingModules");
  const quizzes = db.collection("quizzes");
  const progress = db.collection("employeeTrainingProgress");

  const now = new Date();

  let company = await companies.findOne({ name: COMPANY_NAME });
  if (company) {
    await companies.updateOne(
      { _id: company._id },
      { $set: { industry: COMPANY_INDUSTRY, updatedAt: now } }
    );
    console.log(`Company exists: ${COMPANY_NAME} (${company._id})`);
  } else {
    const result = await companies.insertOne({
      name: COMPANY_NAME,
      industry: COMPANY_INDUSTRY,
      createdAt: now,
      updatedAt: now,
    });
    company = await companies.findOne({ _id: result.insertedId });
    console.log(`Created company: ${COMPANY_NAME} (${company._id})`);
  }

  const companyId = company._id;
  const uploadDir = join(ROOT, "uploads", companyId.toString());
  mkdirSync(uploadDir, { recursive: true });

  const employeeIds = {};
  for (const emp of EMPLOYEES) {
    const existing = await employees.findOne({ companyId, email: emp.email });
    if (existing) {
      await employees.updateOne(
        { _id: existing._id },
        { $set: { ...emp, updatedAt: now } }
      );
      employeeIds[emp.email] = existing._id;
      console.log(`  Employee exists: ${emp.name}`);
    } else {
      const result = await employees.insertOne({
        companyId,
        ...emp,
        createdAt: now,
        updatedAt: now,
      });
      employeeIds[emp.email] = result.insertedId;
      console.log(`  Employee added: ${emp.name}`);
    }
  }

  const sopPaths = [
    "01-opening-procedures.txt",
    "02-customer-service.txt",
    "03-espresso-bar.txt",
    "04-food-safety.txt",
    "05-cash-handling.txt",
    "06-closing-procedures.txt",
  ];

  let moduleCount = 0;
  for (const sopName of sopPaths) {
    const srcPath = join(SOPS_DIR, sopName);
    if (!existsSync(srcPath)) continue;

    const text = readFileSync(srcPath, "utf8");
    let doc = await documents.findOne({ companyId, originalName: sopName });

    const fileName = doc?.fileName || `${randomUUID()}.txt`;
    const filePath = join(uploadDir, fileName);
    if (!existsSync(filePath)) {
      copyFileSync(srcPath, filePath);
    }

    const summary = text.split("\n").find((l) => l.trim() && !l.startsWith("SUNRISE"))?.trim() || sopName;

    if (doc) {
      await documents.updateOne(
        { _id: doc._id },
        {
          $set: {
            extractedText: text,
            summary,
            status: "processed",
            mimeType: "text/plain",
            filePath,
            updatedAt: now,
          },
        }
      );
    } else {
      const result = await documents.insertOne({
        companyId,
        fileName,
        originalName: sopName,
        mimeType: "text/plain",
        filePath,
        status: "processed",
        extractedText: text,
        summary,
        createdAt: now,
        updatedAt: now,
      });
      doc = await documents.findOne({ _id: result.insertedId });
    }

    const training = parseSopTraining(text, sopName);
    let mod = await trainingModules.findOne({ companyId, documentId: doc._id });

    if (mod) {
      await trainingModules.updateOne(
        { _id: mod._id },
        {
          $set: {
            title: training.title,
            description: training.description,
            sections: training.sections,
            estimatedMinutes: training.estimatedMinutes,
            updatedAt: now,
          },
        }
      );
    } else {
      const result = await trainingModules.insertOne({
        companyId,
        documentId: doc._id,
        title: training.title,
        description: training.description,
        sections: training.sections,
        estimatedMinutes: training.estimatedMinutes,
        createdAt: now,
        updatedAt: now,
      });
      mod = { _id: result.insertedId };
      moduleCount++;
    }

    const existingQuiz = await quizzes.findOne({ trainingModuleId: mod._id });
    if (existingQuiz) {
      await quizzes.updateOne(
        { _id: existingQuiz._id },
        {
          $set: {
            title: training.quiz.title,
            questions: training.quiz.questions,
            passingScore: training.quiz.passingScore,
            updatedAt: now,
          },
        }
      );
    } else {
      await quizzes.insertOne({
        companyId,
        trainingModuleId: mod._id,
        title: training.quiz.title,
        questions: training.quiz.questions,
        passingScore: training.quiz.passingScore,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const emp of EMPLOYEES) {
      const employeeId = employeeIds[emp.email];
      const existing = await progress.findOne({
        companyId,
        employeeId,
        trainingModuleId: mod._id,
      });
      if (!existing) {
        await progress.insertOne({
          companyId,
          employeeId,
          trainingModuleId: mod._id,
          status: "assigned",
          completedSections: [],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    console.log(`  SOP ready: ${sopName} → ${training.title}`);
  }

  // Alex: first module in progress for employee demo
  const openingMod = await trainingModules.findOne({
    companyId,
    title: /opening/i,
  });
  if (openingMod && employeeIds["alex@sunrisecoffee.demo"]) {
    await progress.updateOne(
      {
        companyId,
        employeeId: employeeIds["alex@sunrisecoffee.demo"],
        trainingModuleId: openingMod._id,
      },
      {
        $set: {
          status: "in_progress",
          completedSections: [0],
          startedAt: now,
          updatedAt: now,
        },
      }
    );
  }

  const totals = {
    companies: await companies.countDocuments({ _id: companyId }),
    employees: await employees.countDocuments({ companyId }),
    documents: await documents.countDocuments({ companyId }),
    training: await trainingModules.countDocuments({ companyId }),
    quizzes: await quizzes.countDocuments({ companyId }),
  };

  console.log("\n✓ Sunrise Coffee Co. demo data ready in MongoDB");
  console.log(`  Company ID:  ${companyId}`);
  console.log(`  Employees:   ${totals.employees}`);
  console.log(`  Documents:   ${totals.documents} (processed)`);
  console.log(`  Training:    ${totals.training} modules + ${totals.quizzes} quizzes`);
  console.log(`\n  Owner:    http://localhost:3000/owner  → select "${COMPANY_NAME}"`);
  console.log(`  Employee: http://localhost:3000/employee → Alex Rivera`);
  console.log(`  Manager:  http://localhost:3000/manager`);
  if (moduleCount > 0) {
    console.log(`\n  (${moduleCount} new training modules created)`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
