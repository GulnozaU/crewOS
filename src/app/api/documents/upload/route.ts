import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getCollections } from "@/lib/db";
import { ensureUploadDir } from "@/lib/documents";
import { processDocument } from "@/lib/workflows";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const companyId = formData.get("companyId") as string;
  const file = formData.get("file") as File | null;

  if (!companyId || !file) {
    return NextResponse.json(
      { error: "companyId and file are required" },
      { status: 400 }
    );
  }

  const { companies, documents } = await getCollections();
  const company = await companies.findOne({ _id: toObjectId(companyId) });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const ext = path.extname(file.name).toLowerCase() || ".txt";
  const fileName = `${uuidv4()}${ext}`;
  const uploadDir = await ensureUploadDir(companyId);
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const mimeByExt: Record<string, string> = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".text": "text/plain",
  };
  const mimeType =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : mimeByExt[ext] || "application/octet-stream";

  const now = new Date();
  const result = await documents.insertOne({
    companyId: toObjectId(companyId),
    fileName,
    originalName: file.name,
    mimeType,
    filePath,
    status: "uploaded",
    createdAt: now,
    updatedAt: now,
  });

  const doc = await documents.findOne({ _id: result.insertedId });

  processDocument(result.insertedId.toString()).catch((err) => {
    console.error("Document processing failed:", err);
  });

  return NextResponse.json(serialize(doc), { status: 201 });
}
