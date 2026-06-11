import { readFileSync } from "fs";
import { MongoClient } from "mongodb";

const env = readFileSync(".env.local", "utf8");
const uri = env.match(/^MONGODB_URI=(.+)$/m)?.[1]?.trim();
if (!uri) {
  console.error("No MONGODB_URI in .env.local");
  process.exit(1);
}

if (uri === "memory") {
  console.log("MONGODB_URI=memory — app uses in-memory DB at runtime.");
  process.exit(0);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, family: 4 });
try {
  await client.connect();
  const count = await client.db("crewoz").collection("companies").countDocuments();
  console.log("MongoDB OK — companies:", count);
} catch (err) {
  console.error("MongoDB FAIL:", err.message);
  console.error("\nFix in Atlas → Network Access → Add IP Address → Allow from anywhere (0.0.0.0/0)");
  process.exit(1);
} finally {
  await client.close();
}
