import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Mocking the PDF parsing for prototype purposes, as pdf-parse has issues with missing DOM variables on Node.js.
    // The client handles extracting the simulated Pick List data regardless of the text here.
    return NextResponse.json({ text: "Simulated PDF Content\nPick List: 54018554" });
  } catch (error: any) {
    console.error("PDF Parsing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
