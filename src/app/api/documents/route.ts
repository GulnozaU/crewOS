import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const { documents } = await getCollections();
  const list = await documents
    .find({ companyId: toObjectId(companyId) })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(serialize(list));
}
