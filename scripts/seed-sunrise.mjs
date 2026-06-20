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

  const distractors = [
    "Ignore the procedure and continue serving",
    "Skip manager notification",
    "No documentation or checklist required",
    "Close the store early without approval",
  ];

  const questions = cleaned
    .flatMap((s) => s.keyPoints.slice(0, 2).map((point) => ({ section: s.title, point })))
    .filter((x) => x.point)
    .slice(0, 5)
    .map(({ section, point }, i) => {
      const correct = point.length > 100 ? point.slice(0, 97) + "..." : point;
      return {
        id: `q${i + 1}`,
        question: `[${section}] Which action follows the SOP?`,
        options: [correct, distractors[i % distractors.length], distractors[(i + 1) % distractors.length], distractors[(i + 2) % distractors.length]],
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

  // Remove failed/stale uploads so Owner dashboard shows clean processed SOPs only
  const stale = await documents
    .find({
      companyId,
      $or: [
        { status: { $in: ["failed", "processing", "uploaded"] } },
        { originalName: { $nin: sopPaths } },
      ],
    })
    .toArray();
  if (stale.length) {
    const staleIds = stale.map((d) => d._id);
    await documents.deleteMany({ _id: { $in: staleIds } });
    await trainingModules.deleteMany({ companyId, documentId: { $in: staleIds } });
    console.log(`  Cleaned ${stale.length} stale/failed document(s)`);
  }

  for (const sopName of sopPaths) {
    const dupes = await documents
      .find({ companyId, originalName: sopName })
      .sort({ updatedAt: -1 })
      .toArray();
    if (dupes.length > 1) {
      const removeIds = dupes.slice(1).map((d) => d._id);
      await documents.deleteMany({ _id: { $in: removeIds } });
      await trainingModules.deleteMany({ companyId, documentId: { $in: removeIds } });
    }
  }

  const validDocIds = (
    await documents.find({ companyId, originalName: { $in: sopPaths } }).toArray()
  ).map((d) => d._id);
  const orphanMods = await trainingModules
    .find({ companyId, documentId: { $nin: validDocIds } })
    .toArray();
  if (orphanMods.length) {
    const orphanModIds = orphanMods.map((m) => m._id);
    await quizzes.deleteMany({ trainingModuleId: { $in: orphanModIds } });
    await progress.deleteMany({ trainingModuleId: { $in: orphanModIds } });
    await trainingModules.deleteMany({ _id: { $in: orphanModIds } });
    console.log(`  Removed ${orphanMods.length} orphan training module(s)`);
  }

  const modIds = (await trainingModules.find({ companyId }).toArray()).map((m) => m._id);
  const orphanQuizzes = await quizzes.deleteMany({
    companyId,
    trainingModuleId: { $nin: modIds },
  });
  if (orphanQuizzes.deletedCount) {
    console.log(`  Removed ${orphanQuizzes.deletedCount} orphan quiz(zes)`);
  }

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

  // Alex: Opening Procedures completed → quiz ready immediately
  const openingMod = await trainingModules.findOne({ companyId, title: /opening/i });
  const alexId = employeeIds["alex@sunrisecoffee.demo"];
  if (openingMod && alexId) {
    const sectionCount = (await trainingModules.findOne({ _id: openingMod._id }))?.sections?.length || 1;
    const allSections = Array.from({ length: sectionCount }, (_, i) => i);
    await progress.updateOne(
      { companyId, employeeId: alexId, trainingModuleId: openingMod._id },
      {
        $set: {
          status: "completed",
          completedSections: allSections,
          startedAt: now,
          completedAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
    console.log("  Alex → Opening Procedures training marked completed (quiz unlocked)");
  }

  // Ensure every employee has progress rows for every module
  const allModules = await trainingModules.find({ companyId }).toArray();
  for (const mod of allModules) {
    for (const emp of EMPLOYEES) {
      await progress.updateOne(
        { companyId, employeeId: employeeIds[emp.email], trainingModuleId: mod._id },
        {
          $setOnInsert: {
            companyId,
            employeeId: employeeIds[emp.email],
            trainingModuleId: mod._id,
            status: "assigned",
            completedSections: [],
            createdAt: now,
          },
          $set: { updatedAt: now },
        },
        { upsert: true }
      );
    }
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
