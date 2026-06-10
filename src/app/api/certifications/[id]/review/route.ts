import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { createScheduleRecommendation } from "@/lib/workflows";
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
  const recommendation = await collections.certificationRecommendations.findOne({
    _id: toObjectId(id),
  });

  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const now = new Date();

  await collections.certificationRecommendations.updateOne(
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

  await collections.managerFeedback.insertOne({
    companyId: recommendation.companyId,
    recommendationId: recommendation._id!,
    employeeId: recommendation.employeeId,
    recommendationType: "certification",
    originalRecommendation: recommendation.reasoning,
    decision,
    managerComments: managerComments?.trim() || "",
    createdAt: now,
  });

  if (decision === "approved") {
    const existingSchedule = await collections.scheduleRecommendations.findOne({
      companyId: recommendation.companyId,
      status: "pending",
    });
    if (!existingSchedule) {
      try {
        await createScheduleRecommendation(recommendation.companyId);
      } catch (err) {
        console.error("Auto schedule generation after certification approval failed:", err);
      }
    }
  }

  const updated = await collections.certificationRecommendations.findOne({
    _id: toObjectId(id),
  });

  return NextResponse.json(serialize(updated));
}
