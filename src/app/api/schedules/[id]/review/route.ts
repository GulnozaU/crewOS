import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { decision, managerComments } = body;

  if (!decision || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const collections = await getCollections();
  const schedule = await collections.scheduleRecommendations.findOne({
    _id: toObjectId(id),
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const now = new Date();

  await collections.scheduleRecommendations.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        status: decision,
        managerComments: managerComments?.trim() || "",
        reviewedAt: now,
        updatedAt: now,
      },
    }
  );

  const feedbackEmployeeId =
    schedule.shifts.length > 0
      ? toObjectId(schedule.shifts[0].employeeId)
      : schedule.companyId;

  await collections.managerFeedback.insertOne({
    companyId: schedule.companyId,
    recommendationId: schedule._id!,
    employeeId: feedbackEmployeeId,
    recommendationType: "schedule",
    originalRecommendation: schedule.reasoning,
    decision,
    managerComments: managerComments?.trim() || "",
    createdAt: now,
  });

  const updated = await collections.scheduleRecommendations.findOne({
    _id: toObjectId(id),
  });

  return NextResponse.json(serialize(updated));
}
