#!/usr/bin/env node
/** Quick Gemini connectivity test — run: node scripts/test-gemini.mjs */
import { readFileSync } from "fs";
import { resolve } from "path";
import { GoogleGenAI } from "@google/genai";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!apiKey) {
  console.error("GEMINI_API_KEY missing in .env.local");
  process.exit(1);
}

console.log(`Testing key prefix: ${apiKey.slice(0, 3)}... model: ${model}`);

const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model,
  contents: "Reply with exactly: CrewOS Gemini OK",
});

console.log("Response:", response.text);
console.log("SUCCESS — Gemini is working.");
