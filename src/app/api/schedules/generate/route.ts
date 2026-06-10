import { NextRequest, NextResponse } from "next/server";
import { createScheduleRecommendation } from "@/lib/workflows";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, weekStartDate } = body;

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const record = await createScheduleRecommendation(
      toObjectId(companyId),
      weekStartDate
    );
    return NextResponse.json(serialize(record), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Schedule generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
