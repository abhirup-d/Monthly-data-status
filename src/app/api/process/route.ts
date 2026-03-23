import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { processCSV } from "@/lib/csv-parser";
import type { CsvRow } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();

    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: "Failed to parse CSV" }, { status: 400 });
    }

    const result = processCSV(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Process error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
