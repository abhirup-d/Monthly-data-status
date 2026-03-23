import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import archiver from "archiver";
import { generateExcel } from "@/lib/excel-generator";
import type { CsvRow, Selection } from "@/lib/types";
import { PassThrough } from "stream";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const selectionsJson = formData.get("selections") as string | null;

    if (!file || !selectionsJson) {
      return NextResponse.json({ error: "Missing file or selections" }, { status: 400 });
    }

    const selections: Selection[] = JSON.parse(selectionsJson);
    if (selections.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

    // Filter to MONTHLY only
    const monthlyRows = parsed.data.filter(r => r.reporting_frequency === "MONTHLY");

    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, "0")}_${String(today.getMonth() + 1).padStart(2, "0")}_${today.getFullYear()}`;

    // Single file download
    if (selections.length === 1) {
      const sel = selections[0];
      const buffer = await generateExcel(monthlyRows, sel.company, sel.report, sel.bu);
      const safeBu = sel.bu.replace(/[/\\:*?"<>|]/g, "_");
      const filename = `${safeBu} Monthly Data Status ${todayStr}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Multiple files — create ZIP
    const passthrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 5 } });
    const chunks: Buffer[] = [];

    passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));

    archive.pipe(passthrough);

    for (const sel of selections) {
      const buffer = await generateExcel(monthlyRows, sel.company, sel.report, sel.bu);
      const safeCompany = sel.company.replace(/[/\\:*?"<>|]/g, "_");
      const safeReport = sel.report.replace(/[/\\:*?"<>|]/g, "_");
      const safeBu = sel.bu.replace(/[/\\:*?"<>|]/g, "_");
      const filename = `${safeBu} Monthly Data Status ${todayStr}.xlsx`;
      const path = `${safeCompany}/${safeReport}/${filename}`;
      archive.append(buffer, { name: path });
    }

    await archive.finalize();

    // Wait for all data
    await new Promise<void>((resolve) => passthrough.on("end", resolve));
    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Monthly Data Status Reports ${todayStr}.zip"`,
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
