import { MongoClient, Db, Collection } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import type {
  Company,
  DocumentRecord,
  Employee,
  TrainingModule,
  EmployeeTrainingProgress,
  Quiz,
  QuizAttempt,
  RoleplaySession,
  CertificationRecommendation,
  ManagerFeedback,
  ScheduleRecommendation,
  RoleplayWeakness,
  SupplementalTraining,
} from "@/types";

const DB_NAME = process.env.MONGODB_DB || "crewoz";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoMemoryServer: MongoMemoryServer | undefined;
  var _mongoUsingMemory: boolean | undefined;
}

async function memoryUri(): Promise<string> {
  if (!global._mongoMemoryServer) {
    global._mongoMemoryServer = await MongoMemoryServer.create();
    global._mongoUsingMemory = true;
    console.log("[CrewOS] Using in-memory MongoDB (demo mode — data resets on restart)");
  }
  return global._mongoMemoryServer.getUri();
}

function createClient(uri: string): MongoClient {
  return new MongoClient(uri, {
    serverSelectionTimeoutMS: 8_000,
    family: 4,
  });
}

async function connect(uri: string): Promise<MongoClient> {
  const client = createClient(uri);
  await client.connect();
  await client.db(DB_NAME).command({ ping: 1 });
  return client;
}

async function resolveClient(): Promise<MongoClient> {
  const configured = process.env.MONGODB_URI?.trim();

  if (configured === "memory" || !configured) {
    return connect(await memoryUri());
  }

  try {
    return await connect(configured);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[CrewOS] MongoDB Atlas unreachable (${message.slice(0, 80)}…). Falling back to in-memory DB for demo.`
    );
    console.warn("[CrewOS] Fix Atlas Network Access (IP whitelist) or set MONGODB_URI=memory in .env.local");
    return connect(await memoryUri());
  }
}

async function getClientPromise(): Promise<MongoClient> {
  return resolveClient();
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = getClientPromise();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = getClientPromise();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export function isUsingMemoryDb(): boolean {
  return Boolean(global._mongoUsingMemory || process.env.MONGODB_URI?.trim() === "memory");
}

export async function getCollections() {
  const db = await getDb();
  return {
    companies: db.collection<Company>("companies"),
    documents: db.collection<DocumentRecord>("documents"),
    employees: db.collection<Employee>("employees"),
    trainingModules: db.collection<TrainingModule>("trainingModules"),
    employeeTrainingProgress:
      db.collection<EmployeeTrainingProgress>("employeeTrainingProgress"),
    quizzes: db.collection<Quiz>("quizzes"),
    quizAttempts: db.collection<QuizAttempt>("quizAttempts"),
    roleplaySessions: db.collection<RoleplaySession>("roleplaySessions"),
    certificationRecommendations:
      db.collection<CertificationRecommendation>("certificationRecommendations"),
    managerFeedback: db.collection<ManagerFeedback>("managerFeedback"),
    scheduleRecommendations:
      db.collection<ScheduleRecommendation>("scheduleRecommendations"),
    roleplayWeaknesses: db.collection<RoleplayWeakness>("roleplayWeaknesses"),
    supplementalTraining:
      db.collection<SupplementalTraining>("supplementalTraining"),
  };
}

export type Collections = {
  [K in keyof Awaited<ReturnType<typeof getCollections>>]: Collection<
    Awaited<ReturnType<typeof getCollections>>[K] extends Collection<infer T>
      ? T
      : never
  >;
};
