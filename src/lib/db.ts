import { MongoClient, Db, Collection } from "mongodb";
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

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "crewoz";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
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
