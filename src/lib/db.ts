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
}

async function resolveMongoUri(): Promise<string> {
  const configured = process.env.MONGODB_URI?.trim();
  if (configured && configured !== "memory") {
    return configured;
  }

  if (!global._mongoMemoryServer) {
    global._mongoMemoryServer = await MongoMemoryServer.create();
    console.log(
      `[CrewOS] Using in-memory MongoDB at ${global._mongoMemoryServer.getUri()}`
    );
  }

  return global._mongoMemoryServer.getUri();
}

function createClient(uri: string): MongoClient {
  return new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
    // Avoid IPv6 TLS issues on some networks (common Atlas SSL alert 80 cause)
    family: 4,
  });
}

async function getClientPromise(): Promise<MongoClient> {
  const uri = await resolveMongoUri();
  const client = createClient(uri);
  return client.connect();
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
