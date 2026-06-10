import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function ensureUploadDir(companyId: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, companyId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  const buffer = await fs.readFile(filePath);

  if (mimeType === "application/pdf") {
    const data = await pdf(buffer);
    return data.text;
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}. Upload PDF or text files.`);
}

export function getUploadPath(companyId: string, fileName: string): string {
  return path.join(UPLOAD_DIR, companyId, fileName);
}
