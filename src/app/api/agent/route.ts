import { NextRequest, NextResponse } from "next/server";

const ADK_URL = process.env.ADK_AGENT_URL || "http://localhost:8000";
const APP_NAME = "crewoz_agent";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, sessionId, userId } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const session = sessionId || `session-${Date.now()}`;
  const user = userId || "owner";

  try {
    const res = await fetch(`${ADK_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName: APP_NAME,
        userId: user,
        sessionId: session,
        newMessage: {
          role: "user",
          parts: [{ text: message.trim() }],
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: data.error || data.message || "Agent request failed",
          hint: "Is the ADK server running? cd agent && adk api_server --port 8000",
        },
        { status: res.status }
      );
    }

    const text =
      data?.output?.parts?.map((p: { text?: string }) => p.text).join("") ||
      data?.response ||
      data?.text ||
      JSON.stringify(data);

    return NextResponse.json({ response: text, sessionId: session });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Agent unreachable";
    return NextResponse.json(
      {
        error: msg,
        hint: "Start ADK: cd agent && source .venv/bin/activate && adk api_server --port 8000",
      },
      { status: 503 }
    );
  }
}
