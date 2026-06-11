# Hackathon Qualification Guide — MongoDB Track

Complete steps to qualify for the **Google Cloud Rapid Agent Hackathon**.

## What judges require

1. **Partner track:** MongoDB
2. **Google Cloud Agent Builder (ADK):** Python agent in `agent/`
3. **MongoDB MCP:** Agent calls `mongodb-mcp-server` tools at runtime
4. **Gemini:** Agent reasoning via Gemini
5. **Hosted URL + public repo + ~3 min demo video**

---

## Step 1 — Pick MongoDB track (Devpost)

When submitting, select **MongoDB** as your partner track.

---

## Step 2 — Install Python + ADK

```bash
# macOS — install Python 3.12
/opt/homebrew/bin/brew install python@3.12

cd crewOS/agent
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
pip install google-adk
```

Verify:

```bash
adk --help
```

---

## Step 3 — Configure agent environment

From project root:

```bash
chmod +x scripts/setup-agent.sh
./scripts/setup-agent.sh
```

This copies your Gemini key → `GOOGLE_API_KEY` and Atlas URI → `MDB_MCP_CONNECTION_STRING` in `agent/crewoz_agent/.env`.

**MongoDB MCP is wired in** `agent/crewoz_agent/agent.py` via `McpToolset` + `npx mongodb-mcp-server@latest` (read/write enabled).

---

## Step 4 — Run the ADK agent locally

**Terminal 1 — ADK API server:**

```bash
cd crewOS/agent
source .venv/bin/activate
adk api_server --port 8000
```

**Terminal 2 — CrewOS UI:**

```bash
cd crewOS
npm run dev
```

Open:
- **Agent chat:** http://localhost:3000/agent
- **ADK dev UI (optional):** http://localhost:8000

Test prompts:
- "List all companies in the crewoz database"
- "Show employees for Sunrise Coffee Co."
- "What training modules exist and their status?"

You should see the agent **plan steps** and **call MongoDB MCP tools** (`find`, `list-collections`, etc.).

---

## Step 5 — Wire Next.js to agent (done)

Already implemented:
- `src/app/api/agent/route.ts` — proxies to ADK at `http://localhost:8000`
- `src/app/agent/page.tsx` — demo chat UI

Add to `.env.local`:

```env
ADK_AGENT_URL=http://localhost:8000
```

---

## Step 6 — Record demo video (~3 min)

Show this flow:

1. **Owner** uploads SOP → training generated
2. **Agent** (`/agent`): "Show onboarding status for Alex Rivera at Sunrise Coffee Co."
   - Agent calls MongoDB MCP `find` on employees, trainingModules, quizAttempts
3. **Employee** completes training + quiz
4. **Manager** approves certification
5. **Agent**: "Generate schedule recommendation summary from approved certifications"
6. Mention: **Gemini + ADK + MongoDB MCP + Atlas**

---

## Step 7 — Deploy

### UI → Vercel

```bash
# Push to GitHub first
vercel deploy
```

Set environment variables on Vercel:
- `MONGODB_URI`
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.5-flash`
- `ADK_AGENT_URL=https://your-agent-xxx.run.app`

### ADK Agent → Google Cloud Run

```bash
cd agent
gcloud run deploy crewoz-agent \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_API_KEY=...,MDB_MCP_CONNECTION_STRING=...,GEMINI_MODEL=gemini-2.5-flash"
```

Or use `adk deploy` if configured with a GCP project.

---

## Step 8 — Submit on Devpost

| Field | Value |
|-------|-------|
| Track | **MongoDB** |
| Hosted URL | Your Vercel URL |
| Repo | https://github.com/GulnozaU/crewOS |
| Video | YouTube/Loom link (~3 min) |
| Description | ADK agent + MongoDB MCP + Gemini workforce onboarding |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `adk: command not found` | Activate venv: `source agent/.venv/bin/activate` |
| `pip not found` | Use `pip3` or `python3.12 -m pip` |
| Agent unreachable from UI | Start `adk api_server --port 8000` |
| MCP connection failed | Check Atlas URI in `agent/crewoz_agent/.env` |
| Gemini 429 quota | Wait for reset or enable GCP billing |

---

## Project structure

```
crewOS/
├── agent/
│   ├── crewoz_agent/
│   │   ├── agent.py      ← ADK agent + MongoDB MCP
│   │   └── __init__.py
│   ├── requirements.txt
│   └── .env.example
├── src/app/agent/        ← Agent chat UI
├── src/app/api/agent/    ← Proxy to ADK
└── scripts/setup-agent.sh
```
