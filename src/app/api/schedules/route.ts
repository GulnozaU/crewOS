import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const status = request.nextUrl.searchParams.get("status");

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const filter: Record<string, unknown> = {
    companyId: toObjectId(companyId),
  };
  if (status) filter.status = status;

  const { scheduleRecommendations } = await getCollections();
  const schedules = await scheduleRecommendations
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(serialize(schedules));
}
