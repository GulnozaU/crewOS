import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import { getCollections } from "./db";
import { ensureUploadDir } from "./documents";
import { processDocument } from "./workflows";

export const DEMO_COMPANY_NAME = "Sunrise Coffee Co.";
export const DEMO_COMPANY_INDUSTRY = "Food & Beverage";

export const DEMO_EMPLOYEES = [
  { name: "Alex Rivera", email: "alex@sunrisecoffee.demo", role: "Barista" },
  { name: "Jordan Lee", email: "jordan@sunrisecoffee.demo", role: "Shift Lead" },
  { name: "Sam Patel", email: "sam@sunrisecoffee.demo", role: "Manager" },
] as const;

const SOP_FILES = [
  "01-opening-procedures.txt",
  "02-customer-service.txt",
  "03-espresso-bar.txt",
  "04-food-safety.txt",
  "05-cash-handling.txt",
  "06-closing-procedures.txt",
];

function samplesDir(): string {
  return join(process.cwd(), "samples", "sops");
}

let bootstrapPromise: Promise<{ companyId: string; ready: boolean }> | null = null;

export async function ensureDemoReady(): Promise<{ companyId: string; ready: boolean }> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

async function runBootstrap(): Promise<{ companyId: string; ready: boolean }> {
  const collections = await getCollections();
  const now = new Date();

  let company = await collections.companies.findOne({ name: DEMO_COMPANY_NAME });
  if (!company) {
    const result = await collections.companies.insertOne({
      name: DEMO_COMPANY_NAME,
      industry: DEMO_COMPANY_INDUSTRY,
      createdAt: now,
      updatedAt: now,
    });
    company = await collections.companies.findOne({ _id: result.insertedId });
    console.log(`[CrewOS Demo] Created ${DEMO_COMPANY_NAME}`);
  }

  if (!company?._id) throw new Error("Failed to create demo company");

  const companyId = company._id;
  const employeeIds: Record<string, ObjectId> = {};

  for (const emp of DEMO_EMPLOYEES) {
    const existing = await collections.employees.findOne({ companyId, email: emp.email });
    if (existing) {
      employeeIds[emp.email] = existing._id!;
    } else {
      const result = await collections.employees.insertOne({
        companyId,
        ...emp,
        createdAt: now,
        updatedAt: now,
      });
      employeeIds[emp.email] = result.insertedId;
    }
  }

  await ensureUploadDir(companyId.toString());
  const uploadDir = join(process.cwd(), "uploads", companyId.toString());

  for (const sopName of SOP_FILES) {
    const srcPath = join(samplesDir(), sopName);
    if (!existsSync(srcPath)) continue;

    let doc = await collections.documents.findOne({ companyId, originalName: sopName });

    if (!doc) {
      const fileName = `${randomUUID()}.txt`;
      const filePath = join(uploadDir, fileName);
      copyFileSync(srcPath, filePath);

      const result = await collections.documents.insertOne({
        companyId,
        fileName,
        originalName: sopName,
        mimeType: "text/plain",
        filePath,
        status: "uploaded",
        createdAt: now,
        updatedAt: now,
      });
      doc = await collections.documents.findOne({ _id: result.insertedId });
      console.log(`[CrewOS Demo] Queued SOP: ${sopName}`);
    }

    if (doc && doc.status !== "processed") {
      try {
        await processDocument(doc._id!.toString(), { preferLocal: true });
        console.log(`[CrewOS Demo] Processed: ${sopName}`);
      } catch (err) {
        console.error(`[CrewOS Demo] Failed ${sopName}:`, err);
      }
    }
  }

  // Alex: Opening Procedures completed so quiz is ready for demo
  const openingMod = await collections.trainingModules.findOne({
    companyId,
    title: /opening/i,
  });
  const alexId = employeeIds["alex@sunrisecoffee.demo"];
  if (openingMod && alexId) {
    const sectionCount = openingMod.sections?.length || 1;
    await collections.employeeTrainingProgress.updateOne(
      { companyId, employeeId: alexId, trainingModuleId: openingMod._id },
      {
        $set: {
          status: "completed",
          completedSections: Array.from({ length: sectionCount }, (_, i) => i),
          startedAt: now,
          completedAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  const docCount = await collections.documents.countDocuments({ companyId, status: "processed" });
  console.log(
    `[CrewOS Demo] Ready — ${DEMO_COMPANY_NAME}, ${docCount} SOPs processed, 3 employees`
  );

  return { companyId: companyId.toString(), ready: docCount >= 1 };
}

export function listSampleSops(): string[] {
  const dir = samplesDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".txt"));
}
