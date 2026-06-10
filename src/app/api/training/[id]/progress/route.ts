import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainingModuleId } = await params;
  const body = await request.json();
  const { companyId, employeeId, sectionIndex, complete } = body;

  if (!companyId || !employeeId) {
    return NextResponse.json(
      { error: "companyId and employeeId are required" },
      { status: 400 }
    );
  }

  const collections = await getCollections();
  const now = new Date();

  const existing = await collections.employeeTrainingProgress.findOne({
    companyId: toObjectId(companyId),
    employeeId: toObjectId(employeeId),
    trainingModuleId: toObjectId(trainingModuleId),
  });

  if (!existing) {
    return NextResponse.json({ error: "Training not assigned" }, { status: 404 });
  }

  const completedSections = [...existing.completedSections];
  if (typeof sectionIndex === "number" && !completedSections.includes(sectionIndex)) {
    completedSections.push(sectionIndex);
    completedSections.sort((a, b) => a - b);
  }

  const module = await collections.trainingModules.findOne({
    _id: toObjectId(trainingModuleId),
  });

  const allSectionsDone =
    complete ||
    (module && completedSections.length >= module.sections.length);

  const update = {
    completedSections,
    status: allSectionsDone ? ("completed" as const) : ("in_progress" as const),
    updatedAt: now,
    ...(existing.status === "assigned" && !existing.startedAt
      ? { startedAt: now }
      : {}),
    ...(allSectionsDone ? { completedAt: now } : {}),
  };

  await collections.employeeTrainingProgress.updateOne(
    { _id: existing._id },
    { $set: update }
  );

  const updated = await collections.employeeTrainingProgress.findOne({
    _id: existing._id,
  });

  return NextResponse.json(serialize(updated));
}
