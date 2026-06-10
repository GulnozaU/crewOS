import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { toObjectId, serialize } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const employeeId = request.nextUrl.searchParams.get("employeeId");

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const collections = await getCollections();
  const modules = await collections.trainingModules
    .find({ companyId: toObjectId(companyId) })
    .sort({ createdAt: -1 })
    .toArray();

  let progressMap: Record<string, unknown> = {};
  if (employeeId) {
    const progress = await collections.employeeTrainingProgress
      .find({
        companyId: toObjectId(companyId),
        employeeId: toObjectId(employeeId),
      })
      .toArray();
    progressMap = Object.fromEntries(
      progress.map((p) => [p.trainingModuleId.toString(), serialize(p)])
    );
  }

  const supplemental = employeeId
    ? await collections.supplementalTraining
        .find({
          companyId: toObjectId(companyId),
          employeeId: toObjectId(employeeId),
        })
        .sort({ createdAt: -1 })
        .toArray()
    : [];

  return NextResponse.json({
    modules: serialize(modules),
    progress: progressMap,
    supplemental: serialize(supplemental),
  });
}
