import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const employeeId = request.nextUrl.searchParams.get("employeeId");

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const filter: Record<string, unknown> = {
    companyId: toObjectId(companyId),
  };
  if (employeeId) filter.employeeId = toObjectId(employeeId);

  const { quizAttempts } = await getCollections();
  const attempts = await quizAttempts
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(serialize(attempts));
}
