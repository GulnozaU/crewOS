import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const { employees } = await getCollections();
  const list = await employees
    .find({ companyId: toObjectId(companyId) })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(serialize(list));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, name, email, role } = body;

  if (!companyId || !name?.trim() || !email?.trim() || !role?.trim()) {
    return NextResponse.json(
      { error: "companyId, name, email, and role are required" },
      { status: 400 }
    );
  }

  const collections = await getCollections();
  const company = await collections.companies.findOne({
    _id: toObjectId(companyId),
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const now = new Date();
  const result = await collections.employees.insertOne({
    companyId: toObjectId(companyId),
    name: name.trim(),
    email: email.trim(),
    role: role.trim(),
    createdAt: now,
    updatedAt: now,
  });

  const modules = await collections.trainingModules
    .find({ companyId: toObjectId(companyId) })
    .toArray();

  if (modules.length > 0) {
    await collections.employeeTrainingProgress.insertMany(
      modules.map((mod) => ({
        companyId: toObjectId(companyId),
        employeeId: result.insertedId,
        trainingModuleId: mod._id!,
        status: "assigned" as const,
        completedSections: [],
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  const employee = await collections.employees.findOne({ _id: result.insertedId });
  return NextResponse.json(serialize(employee), { status: 201 });
}
