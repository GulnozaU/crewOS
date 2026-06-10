# CrewOS

AI Workforce Manager for small businesses. Upload SOPs and operational documents, and CrewOS uses Google Gemini to generate training, quizzes, roleplay scenarios, certification recommendations, and schedules — all persisted in MongoDB.

**Repository:** [github.com/GulnozaU/crewOS](https://github.com/GulnozaU/crewOS)

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Google Gemini API key

## Setup

```bash
git clone https://github.com/GulnozaU/crewOS.git
cd crewOS
cp .env.example .env.local
# Edit .env.local with your MONGODB_URI and GEMINI_API_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow

1. **Owner Dashboard** — Create a company, upload PDF/text documents, add employees
2. Documents are processed by Gemini → training modules + quizzes are generated in MongoDB
3. **Employee Portal** — Complete training, take quiz, roleplay, chat with AI manager
4. Quiz is scored against Gemini-generated correct answers
5. Roleplay is evaluated by Gemini; weaknesses trigger supplemental training
6. AI generates certification recommendation (informed by manager feedback history)
7. **Manager Review** — Approve/reject certifications with comments (stored for learning)
8. Owner generates and approves AI schedule recommendations

## MongoDB Collections

`companies`, `documents`, `employees`, `trainingModules`, `employeeTrainingProgress`, `quizzes`, `quizAttempts`, `roleplaySessions`, `certificationRecommendations`, `managerFeedback`, `scheduleRecommendations`, `roleplayWeaknesses`, `supplementalTraining`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB` | No | Database name (default: `crewoz`) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_MODEL` | No | Model name (default: `gemini-2.0-flash`) |
