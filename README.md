# CrewOS

AI Workforce Manager for small businesses. Upload SOPs and operational documents, and CrewOS uses Google Gemini to generate training, quizzes, roleplay scenarios, certification recommendations, and schedules — all persisted in MongoDB.

**Repository:** [github.com/GulnozaU/crewOS](https://github.com/GulnozaU/crewOS)

## Prerequisites

- Node.js 20+
- Google Gemini API key ([AI Studio](https://aistudio.google.com/apikey)) — supports `AIza...` and new `AQ.` auth keys
- MongoDB Atlas (recommended) or `MONGODB_URI=memory` for local dev without install

## Setup

```bash
git clone https://github.com/GulnozaU/crewOS.git
cd crewOS
cp .env.example .env.local
# Edit .env.local — set GEMINI_API_KEY and MONGODB_URI (Atlas connection string)

npm install
npm run dev

# Optional: seed demo company + 6 sample SOPs
npm run seed

# Optional: verify Gemini connectivity
node scripts/test-gemini.mjs
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow

1. **Owner Dashboard** — Create a company, upload PDF/text documents, add employees
2. Documents are processed by Gemini → training modules + quizzes are generated in MongoDB
3. **Employee Portal** — Complete training, take quiz, roleplay, chat with AI manager
4. Quiz is scored by Gemini against training content
5. Roleplay is evaluated by Gemini; weaknesses trigger supplemental training
6. AI generates certification recommendation (informed by manager feedback history)
7. **Manager Review** — Approve/reject certifications with comments (stored for learning)
8. After manager approves certification, AI schedule is generated and owner/manager reviews it

## MongoDB Collections

`companies`, `documents`, `employees`, `trainingModules`, `employeeTrainingProgress`, `quizzes`, `quizAttempts`, `roleplaySessions`, `certificationRecommendations`, `managerFeedback`, `scheduleRecommendations`, `roleplayWeaknesses`, `supplementalTraining`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string, or `memory` for embedded local DB |
| `MONGODB_DB` | No | Database name (default: `crewoz`) |
| `GEMINI_API_KEY` | Yes | Gemini API key from AI Studio (`AIza...` or `AQ....`) |
| `GEMINI_MODEL` | No | Model name (default: `gemini-2.5-flash`) |
