import { NextRequest, NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { processDocument } from "@/lib/workflows";
import { toObjectId, serialize } from "@/lib/utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collections = await getCollections();

  const doc = await collections.documents.findOne({ _id: toObjectId(id) });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.status === "processing") {
    return NextResponse.json(
      { error: "Document is already processing" },
      { status: 400 }
    );
  }

  await collections.documents.updateOne(
    { _id: doc._id },
    {
      $set: { status: "uploaded", updatedAt: new Date() },
      $unset: { processingError: "" },
    }
  );

  processDocument(id).catch((err) => {
    console.error("Document reprocessing failed:", err);
  });

  const updated = await collections.documents.findOne({ _id: doc._id });
  return NextResponse.json(serialize(updated));
}
