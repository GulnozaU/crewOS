import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { generateScheduleRecommendation } from "@/lib/gemini";
import { getHistoricalManagerFeedback } from "@/lib/workflows";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, weekStartDate } = body;

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const collections = await getCollections();
  const employees = await collections.employees
    .find({ companyId: toObjectId(companyId) })
    .toArray();

  if (employees.length === 0) {
    return NextResponse.json(
      { error: "Add employees before generating a schedule" },
      { status: 400 }
    );
  }

  const approvedCerts = await collections.certificationRecommendations
    .find({ companyId: toObjectId(companyId), status: "approved" })
    .toArray();

  const approvedWithDetails = await Promise.all(
    approvedCerts.map(async (cert) => {
      const emp = employees.find((e) => e._id?.equals(cert.employeeId));
      const mod = await collections.trainingModules.findOne({
        _id: cert.trainingModuleId,
      });
      return {
        employeeName: emp?.name || "Unknown",
        role: emp?.role || "Unknown",
        moduleTitle: mod?.title || "Unknown",
      };
    })
  );

  const scheduleFeedback = (await getHistoricalManagerFeedback(toObjectId(companyId)))
    .filter((f) => f.recommendationType === "schedule");

  const startDate =
    weekStartDate ||
    new Date().toISOString().split("T")[0];

  const schedule = await generateScheduleRecommendation(
    employees,
    approvedWithDetails,
    scheduleFeedback,
    startDate
  );

  const now = new Date();
  const result = await collections.scheduleRecommendations.insertOne({
    companyId: toObjectId(companyId),
    weekStartDate: startDate,
    shifts: schedule.shifts,
    reasoning: schedule.reasoning,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const record = await collections.scheduleRecommendations.findOne({
    _id: result.insertedId,
  });

  return NextResponse.json(serialize(record), { status: 201 });
}
