import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { chatWithManager } from "@/lib/gemini";
import { getCompanyKnowledgeContext } from "@/lib/workflows";
import { toObjectId } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, employeeId, message, history } = body;

  if (!companyId || !employeeId || !message?.trim()) {
    return NextResponse.json(
      { error: "companyId, employeeId, and message are required" },
      { status: 400 }
    );
  }

  const { employees } = await getCollections();
  const employee = await employees.findOne({ _id: toObjectId(employeeId) });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const companyContext = await getCompanyKnowledgeContext(toObjectId(companyId));

  if (!companyContext.trim()) {
    return NextResponse.json({
      response:
        "No company knowledge is available yet. Ask your manager to upload SOP documents first.",
    });
  }

  const response = await chatWithManager(
    companyContext,
    employee.name,
    employee.role,
    message.trim(),
    Array.isArray(history) ? history : []
  );

  return NextResponse.json({ response });
}
