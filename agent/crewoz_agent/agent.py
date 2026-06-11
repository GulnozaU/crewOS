import os

from google.adk.agents import Agent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

MONGODB_URI = os.environ.get("MDB_MCP_CONNECTION_STRING") or os.environ.get(
    "MONGODB_URI", "mongodb://localhost:27017/crewoz"
)

CREWOS_INSTRUCTION = """You are CrewOS — an AI workforce manager agent for small businesses.

You help owners and managers onboard employees using company SOP documents stored in MongoDB.

DATABASE: crewoz (MongoDB Atlas)
Collections: companies, documents, employees, trainingModules, employeeTrainingProgress,
quizzes, quizAttempts, roleplaySessions, certificationRecommendations, managerFeedback,
scheduleRecommendations, roleplayWeaknesses, supplementalTraining

YOUR JOB — plan and execute multi-step tasks using MongoDB MCP tools:
1. Query companies, employees, documents, and training status
2. Inspect collection schemas when needed (collection-schema)
3. Find processed documents and training modules (find, aggregate)
4. Report on quiz attempts, roleplay sessions, and certification status
5. Insert or update records when asked to assign training or record outcomes (insert-many, update-many)
6. Explain next steps for onboarding: SOP upload → training → quiz → roleplay → certification → schedule

RULES:
- Always use MCP tools to read/write data. Never invent database contents.
- Plan steps before acting. State what you will do, then call tools.
- If data is missing, say what's missing and which collection to check.
- For write operations, confirm the companyId and employeeId when available.
- Be concise and action-oriented for managers demoing the system.
"""

root_agent = Agent(
    model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    name="crewoz_agent",
    description="CrewOS AI workforce manager with MongoDB MCP tools",
    instruction=CREWOS_INSTRUCTION,
    tools=[
        McpToolset(
            connection_params=StdioConnectionParams(
                server_params=StdioServerParameters(
                    command="npx",
                    args=["-y", "mongodb-mcp-server@latest"],
                    env={
                        "MDB_MCP_CONNECTION_STRING": MONGODB_URI,
                    },
                ),
                timeout=60,
            ),
        )
    ],
)
