import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { generateExcel } from "@/lib/excel-generator";
import type { CsvRow, Selection } from "@/lib/types";
import { PassThrough } from "stream";

export const runtime = "nodejs";

// Allow large request bodies (filtered CSV rows can still be several MB)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { rows: CsvRow[]; yearlyRows?: CsvRow[]; selections: Selection[] };
    const { rows, yearlyRows, selections } = body;

    if (!rows || !selections || selections.length === 0) {
      return NextResponse.json({ error: "Missing rows or selections" }, { status: 400 });
    }

    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, "0")}_${String(today.getMonth() + 1).padStart(2, "0")}_${today.getFullYear()}`;

    // Single file download
    if (selections.length === 1) {
      const sel = selections[0];
      const buffer = await generateExcel(rows, sel.company, sel.report, sel.bu, yearlyRows);
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
    const chunks: Uint8Array[] = [];

    passthrough.on("data", (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));

    archive.pipe(passthrough);

    for (const sel of selections) {
      const buffer = await generateExcel(rows, sel.company, sel.report, sel.bu, yearlyRows);
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
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const zipBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      zipBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return new NextResponse(zipBuffer, {
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
