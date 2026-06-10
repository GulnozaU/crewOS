import { ObjectId } from "mongodb";

export type DocumentStatus = "uploaded" | "processing" | "processed" | "failed";
export type TrainingStatus = "assigned" | "in_progress" | "completed";
export type RecommendationStatus = "pending" | "approved" | "rejected";
export type ScheduleStatus = "pending" | "approved" | "rejected";
export type RoleplayStatus = "active" | "completed" | "evaluated";

export interface Company {
  _id?: ObjectId;
  name: string;
  industry?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRecord {
  _id?: ObjectId;
  companyId: ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  filePath: string;
  status: DocumentStatus;
  extractedText?: string;
  summary?: string;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  _id?: ObjectId;
  companyId: ObjectId;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingSection {
  title: string;
  content: string;
  keyPoints: string[];
}

export interface TrainingModule {
  _id?: ObjectId;
  companyId: ObjectId;
  documentId: ObjectId;
  title: string;
  description: string;
  sections: TrainingSection[];
  estimatedMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeTrainingProgress {
  _id?: ObjectId;
  companyId: ObjectId;
  employeeId: ObjectId;
  trainingModuleId: ObjectId;
  status: TrainingStatus;
  completedSections: number[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  _id?: ObjectId;
  companyId: ObjectId;
  trainingModuleId: ObjectId;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
}

export interface QuizAttempt {
  _id?: ObjectId;
  companyId: ObjectId;
  employeeId: ObjectId;
  quizId: ObjectId;
  trainingModuleId: ObjectId;
  answers: QuizAnswer[];
  score: number;
  passed: boolean;
  completedAt: Date;
  createdAt: Date;
}

export interface RoleplayMessage {
  role: "system" | "customer" | "employee" | "evaluator";
  content: string;
  timestamp: Date;
}

export interface RoleplayEvaluation {
  overallScore: number;
  categories: {
    name: string;
    score: number;
    feedback: string;
    passed: boolean;
  }[];
  weakAreas: string[];
  strengths: string[];
  summary: string;
}

export interface RoleplaySession {
  _id?: ObjectId;
  companyId: ObjectId;
  employeeId: ObjectId;
  trainingModuleId: ObjectId;
  scenarioTitle: string;
  scenarioDescription: string;
  customerPersona: string;
  objectives: string[];
  messages: RoleplayMessage[];
  status: RoleplayStatus;
  evaluation?: RoleplayEvaluation;
  createdAt: Date;
  updatedAt: Date;
}

export interface CertificationRecommendation {
  _id?: ObjectId;
  companyId: ObjectId;
  employeeId: ObjectId;
  trainingModuleId: ObjectId;
  quizAttemptId?: ObjectId;
  roleplaySessionId?: ObjectId;
  recommended: boolean;
  confidence: number;
  reasoning: string;
  status: RecommendationStatus;
  managerComments?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagerFeedback {
  _id?: ObjectId;
  companyId: ObjectId;
  recommendationId: ObjectId;
  employeeId: ObjectId;
  recommendationType: "certification" | "schedule";
  originalRecommendation: string;
  decision: "approved" | "rejected";
  managerComments: string;
  createdAt: Date;
}

export interface ScheduleShift {
  employeeId: string;
  employeeName: string;
  day: string;
  startTime: string;
  endTime: string;
  role: string;
  notes?: string;
}

export interface ScheduleRecommendation {
  _id?: ObjectId;
  companyId: ObjectId;
  weekStartDate: string;
  shifts: ScheduleShift[];
  reasoning: string;
  status: ScheduleStatus;
  managerComments?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleplayWeakness {
  _id?: ObjectId;
  companyId: ObjectId;
  employeeId: ObjectId;
  category: string;
  topic: string;
  occurrenceCount: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplementalTraining {
  _id?: ObjectId;
  companyId: ObjectId;
  employeeId: ObjectId;
  weaknessId: ObjectId;
  title: string;
  content: string;
  sourceWeakAreas: string[];
  createdAt: Date;
}
