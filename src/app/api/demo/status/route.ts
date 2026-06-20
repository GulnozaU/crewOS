import { NextResponse } from "next/server";
import { ensureDemoReady, DEMO_COMPANY_NAME } from "@/lib/bootstrap-demo";
import { getCollections } from "@/lib/db";

export async function GET() {
  try {
    const result = await ensureDemoReady();
    const collections = await getCollections();
    const company = await collections.companies.findOne({
      name: DEMO_COMPANY_NAME,
    });
    const employees = company
      ? await collections.employees.find({ companyId: company._id }).toArray()
      : [];
    const documents = company
      ? await collections.documents.find({ companyId: company._id }).toArray()
      : [];
    const training = company
      ? await collections.trainingModules.countDocuments({ companyId: company._id })
      : 0;

    return NextResponse.json({
      ready: result.ready,
      company: company
        ? { _id: company._id!.toString(), name: company.name, industry: company.industry }
        : null,
      employees: employees.map((e) => ({
        _id: e._id!.toString(),
        name: e.name,
        role: e.role,
        email: e.email,
      })),
      documents: documents.map((d) => ({
        _id: d._id!.toString(),
        name: d.originalName,
        status: d.status,
      })),
      trainingModules: training,
      demoFlow: {
        owner: "Sunrise Coffee Co. — 6 SOPs processed",
        employee: "Alex Rivera — Opening Procedures quiz ready",
        manager: "Sam Patel — approve certifications",
        agent: 'Ask: "Show onboarding status for Alex at Sunrise Coffee Co."',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bootstrap failed";
    return NextResponse.json({ error: message, ready: false }, { status: 503 });
  }
}

export async function POST() {
  return GET();
}
