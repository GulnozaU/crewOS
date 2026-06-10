import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { serialize } from "@/lib/utils";

export async function GET() {
  const { companies } = await getCollections();
  const list = await companies.find().sort({ createdAt: -1 }).toArray();
  return NextResponse.json(serialize(list));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const now = new Date();
  const { companies } = await getCollections();
  const result = await companies.insertOne({
    name,
    industry: body.industry?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });

  const company = await companies.findOne({ _id: result.insertedId });
  return NextResponse.json(serialize(company), { status: 201 });
}
