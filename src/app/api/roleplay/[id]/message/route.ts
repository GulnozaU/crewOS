import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { generateCustomerResponse } from "@/lib/gemini";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const collections = await getCollections();
  const session = await collections.roleplaySessions.findOne({
    _id: toObjectId(sessionId),
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  const now = new Date();
  const messages = [
    ...session.messages,
    { role: "employee" as const, content: message.trim(), timestamp: now },
  ];

  const history = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const customerReply = await generateCustomerResponse(
    session.scenarioDescription,
    session.customerPersona,
    history,
    message.trim()
  );

  messages.push({
    role: "customer",
    content: customerReply.response,
    timestamp: new Date(),
  });

  const newStatus = customerReply.isComplete ? "completed" : "active";

  await collections.roleplaySessions.updateOne(
    { _id: toObjectId(sessionId) },
    {
      $set: {
        messages,
        status: newStatus,
        updatedAt: new Date(),
      },
    }
  );

  const updated = await collections.roleplaySessions.findOne({
    _id: toObjectId(sessionId),
  });

  return NextResponse.json(serialize(updated));
}
