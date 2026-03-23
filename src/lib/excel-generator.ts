import ExcelJS from "exceljs";
import type { CsvRow } from "./types";

const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
const GROUP_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFED7D31" } };
const GROUP_FONT: Partial<ExcelJS.Font> = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
const COMPLETED_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
const COMPLETED_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, color: { argb: "FF006100" } };
const PENDING_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4EC" } };
const PENDING_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, color: { argb: "FFC00000" } };
const YET_TO_START_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const YET_TO_START_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, color: { argb: "FF7F6000" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
  left: { style: "thin", color: { argb: "FFD9D9D9" } },
  right: { style: "thin", color: { argb: "FFD9D9D9" } },
};
const CENTER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
const LEFT_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: "left", vertical: "middle", wrapText: true };

function parseMonthDetail(md: string): [number, number] | null {
  if (!md || !md.startsWith("RP-MN-")) return null;
  const parts = md.split("-");
  if (parts.length === 4) {
    const year = parseInt(parts[2], 10);
    const month = parseInt(parts[3], 10);
    if (!isNaN(year) && !isNaN(month)) return [year, month];
  }
  return null;
}

function isMonthOver(year: number, month: number, today: Date): boolean {
  const lastDay = new Date(year, month, 0).getDate();
  const endOfMonth = new Date(year, month - 1, lastDay);
  return today > endOfMonth;
}

function getFyMonths(dataStartDate: string): [number, number][] {
  try {
    const parts = dataStartDate.split(" ");
    const monthStr = parts[1];
    const year = parseInt(parts[3], 10);
    const monthMap: Record<string, number> = {
      Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
      Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    };
    const startMonth = monthMap[monthStr] || 4;
    const months: [number, number][] = [];
    let y = year, m = startMonth;
    for (let i = 0; i < 12; i++) {
      months.push([y, m]);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months;
  } catch {
    return [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(m => [2025, m]);
  }
}

function getFyLabel(dataStartDate: string): string {
  try {
    const parts = dataStartDate.split(" ");
    const startYear = parseInt(parts[3], 10);
    const monthStr = parts[1];
    const monthMap: Record<string, number> = {
      Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
      Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    };
    const startMonth = monthMap[monthStr] || 4;
    // If starting Apr or later, FY spans startYear to startYear+1
    if (startMonth >= 4) {
      return `FY ${startYear}-${String(startYear + 1).slice(2)}`;
    }
    return `FY ${startYear - 1}-${String(startYear).slice(2)}`;
  } catch {
    return "FY 2025-26";
  }
}

function formatUpdatedAt(tsStr: string): string {
  if (!tsStr) return "";
  try {
    const dt = new Date(tsStr);
    if (isNaN(dt.getTime())) return "";
    const day = String(dt.getDate()).padStart(2, "0");
    const mon = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    let hours = dt.getHours();
    const mins = String(dt.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    return `${day}/${mon}/${year} ${String(hours).padStart(2, "0")}:${mins} ${ampm}`;
  } catch {
    return "";
  }
}

function writeMonthlySheet(
  ws: ExcelJS.Worksheet,
  sheetTitle: string,
  groupCol: "assignee" | "u_reviewer",
  statusCol: "monthly_question_status" | "monthly_approval_status",
  pendingLabel: string,
  rows: CsvRow[],
  fyMonths: [number, number][],
  buName: string,
  today: Date,
  todayDisplay: string
) {
  const headers = ["Row Labels", ...MONTH_LABELS.slice(0, fyMonths.length), "Last Updated"];
  const numCols = headers.length;

  const companyName = rows[0]?.company_name || "";
  const reportName = rows[0]?.report || "";

  // Title row
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${companyName} - ${buName} Monthly Status (${sheetTitle})`;
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF2F5496" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Report name row
  ws.mergeCells(2, 1, 2, numCols);
  const reportCell = ws.getCell(2, 1);
  reportCell.value = `Report: ${reportName}`;
  reportCell.font = { name: "Calibri", bold: true, size: 11, color: { argb: "FF2F5496" } };
  reportCell.alignment = { horizontal: "center", vertical: "middle" };

  // Status as on row
  ws.mergeCells(3, 1, 3, numCols);
  const statusCell = ws.getCell(3, 1);
  statusCell.value = `Status as on: ${todayDisplay}`;
  statusCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF2F5496" } };
  statusCell.alignment = { horizontal: "center", vertical: "middle" };

  // Header row (row 5)
  const headerRow = ws.getRow(5);
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = CENTER_ALIGN;
    cell.border = THIN_BORDER;
  });

  // Build lookup
  const qidMonthStatus = new Map<string, boolean>();
  const qidMonthUpdated = new Map<string, Date>();
  const qidToTitle = new Map<string, string>();
  const groupQids = new Map<string, Set<string>>();

  for (const r of rows) {
    const parsed = parseMonthDetail(r.month_detail);
    if (!parsed) continue;
    const [year, month] = parsed;
    const groupPerson = (r[groupCol] || "").trim();
    const qid = (r.question_id || "").trim();
    const title = (r.title || "").trim();
    const status = (r[statusCol] || "").trim();

    qidToTitle.set(qid, title);

    if (!groupQids.has(groupPerson)) groupQids.set(groupPerson, new Set());
    groupQids.get(groupPerson)!.add(qid);

    const qmKey = `${qid}|${year}|${month}`;
    if (!qidMonthStatus.has(qmKey)) {
      qidMonthStatus.set(qmKey, status === "COMPLETED");
    } else if (status === "COMPLETED") {
      qidMonthStatus.set(qmKey, true);
    }

    if (r.month_updated_at) {
      try {
        const updatedDt = new Date(r.month_updated_at);
        if (!isNaN(updatedDt.getTime())) {
          const existing = qidMonthUpdated.get(qmKey);
          if (!existing || updatedDt > existing) {
            qidMonthUpdated.set(qmKey, updatedDt);
          }
        }
      } catch { /* skip */ }
    }
  }

  // Build latest_updated per (group_person, qid)
  const latestUpdatedMap = new Map<string, Date>();
  for (const [qmKey, updatedDt] of qidMonthUpdated.entries()) {
    const qid = qmKey.split("|")[0];
    for (const [groupPerson, qidSet] of groupQids.entries()) {
      if (qidSet.has(qid)) {
        const rowKey = `${groupPerson}|${qid}`;
        const existing = latestUpdatedMap.get(rowKey);
        if (!existing || updatedDt > existing) {
          latestUpdatedMap.set(rowKey, updatedDt);
        }
      }
    }
  }

  let rowNum = 6;
  const sortedGroups = [...groupQids.keys()].sort();

  for (const groupPerson of sortedGroups) {
    const qids = groupQids.get(groupPerson)!;
    const sortedQids = [...qids].sort((a, b) => (qidToTitle.get(a) || "").localeCompare(qidToTitle.get(b) || ""));

    // Group header row (orange)
    const groupRow = ws.getRow(rowNum);
    for (let col = 1; col <= numCols; col++) {
      const cell = groupRow.getCell(col);
      cell.value = col === 1 ? groupPerson : "";
      cell.fill = GROUP_FILL;
      cell.font = GROUP_FONT;
      cell.alignment = col === 1 ? LEFT_ALIGN : CENTER_ALIGN;
      cell.border = THIN_BORDER;
    }
    rowNum++;

    // Question rows
    for (const qid of sortedQids) {
      const title = qidToTitle.get(qid) || qid;
      const dataRow = ws.getRow(rowNum);

      const tCell = dataRow.getCell(1);
      tCell.value = `    ${title}`;
      tCell.font = { name: "Calibri", size: 10 };
      tCell.alignment = LEFT_ALIGN;
      tCell.border = THIN_BORDER;

      fyMonths.forEach(([yr, mn], idx) => {
        const cell = dataRow.getCell(idx + 2);
        cell.border = THIN_BORDER;
        cell.alignment = CENTER_ALIGN;

        const qmKey = `${qid}|${yr}|${mn}`;
        if (qidMonthStatus.get(qmKey)) {
          cell.value = "Completed";
          cell.font = COMPLETED_FONT;
          cell.fill = COMPLETED_FILL;
        } else if (!isMonthOver(yr, mn, today)) {
          cell.value = "Yet to Start";
          cell.font = YET_TO_START_FONT;
          cell.fill = YET_TO_START_FILL;
        } else {
          cell.value = pendingLabel;
          cell.font = PENDING_FONT;
          cell.fill = PENDING_FILL;
        }
      });

      const lastCol = fyMonths.length + 2;
      const updatedCell = dataRow.getCell(lastCol);
      updatedCell.border = THIN_BORDER;
      updatedCell.alignment = CENTER_ALIGN;
      updatedCell.font = { name: "Calibri", size: 9 };
      const rowKey = `${groupPerson}|${qid}`;
      const latestDt = latestUpdatedMap.get(rowKey);
      if (latestDt) {
        updatedCell.value = formatUpdatedAt(latestDt.toISOString());
      }

      rowNum++;
    }
  }

  // Notes section
  rowNum += 2;
  const notes = [
    { text: "Note:", bold: true, italic: false },
    { text: `"${pendingLabel}" represents that this question is not completed or not sent for review.`, bold: false, italic: true },
    { text: '"Completed" represents that the question for that month is completed.', bold: false, italic: true },
    { text: '"Yet to Start" represents that the month has not ended yet and data is not yet due.', bold: false, italic: true },
  ];
  for (const note of notes) {
    ws.mergeCells(rowNum, 1, rowNum, numCols);
    const cell = ws.getCell(rowNum, 1);
    cell.value = note.text;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { name: "Calibri", bold: note.bold, italic: note.italic, size: note.bold ? 10 : 9 };
    rowNum++;
  }

  // Column widths
  ws.getColumn(1).width = 45;
  for (let i = 2; i <= fyMonths.length + 1; i++) {
    ws.getColumn(i).width = 18;
  }
  ws.getColumn(fyMonths.length + 2).width = 22;

  // Freeze panes
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 5, topLeftCell: "B6", activeCell: "B6" }];
}

function writeYearlySheet(
  ws: ExcelJS.Worksheet,
  sheetTitle: string,
  groupCol: "assignee" | "u_reviewer",
  statusCol: "question_status" | "approval_status",
  pendingLabel: string,
  rows: CsvRow[],
  buName: string,
  todayDisplay: string
) {
  const fyLabel = getFyLabel(rows[0]?.data_start_date || "");
  const headers = ["Row Labels", fyLabel, "Last Updated"];
  const numCols = headers.length;

  const companyName = rows[0]?.company_name || "";
  const reportName = rows[0]?.report || "";

  // Title row
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${companyName} - ${buName} Yearly Status (${sheetTitle})`;
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF2F5496" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Report name row
  ws.mergeCells(2, 1, 2, numCols);
  const reportCell = ws.getCell(2, 1);
  reportCell.value = `Report: ${reportName}`;
  reportCell.font = { name: "Calibri", bold: true, size: 11, color: { argb: "FF2F5496" } };
  reportCell.alignment = { horizontal: "center", vertical: "middle" };

  // Status as on row
  ws.mergeCells(3, 1, 3, numCols);
  const statusCell = ws.getCell(3, 1);
  statusCell.value = `Status as on: ${todayDisplay}`;
  statusCell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FF2F5496" } };
  statusCell.alignment = { horizontal: "center", vertical: "middle" };

  // Header row (row 5)
  const headerRow = ws.getRow(5);
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = CENTER_ALIGN;
    cell.border = THIN_BORDER;
  });

  // Build lookup: dedup by question_id — if ANY row is COMPLETED, mark completed
  const qidStatus = new Map<string, boolean>();
  const qidToTitle = new Map<string, string>();
  const qidLatestUpdated = new Map<string, Date>();
  const groupQids = new Map<string, Set<string>>();

  for (const r of rows) {
    const groupPerson = (r[groupCol] || "").trim();
    if (!groupPerson) continue;
    const qid = (r.question_id || "").trim();
    const title = (r.title || "").trim();
    const status = (r[statusCol] || "").trim();

    qidToTitle.set(qid, title);

    if (!groupQids.has(groupPerson)) groupQids.set(groupPerson, new Set());
    groupQids.get(groupPerson)!.add(qid);

    if (!qidStatus.has(qid)) {
      qidStatus.set(qid, status === "COMPLETED");
    } else if (status === "COMPLETED") {
      qidStatus.set(qid, true);
    }

    // Track latest updated_at
    const updatedStr = r.updated_at;
    if (updatedStr) {
      try {
        const updatedDt = new Date(updatedStr);
        if (!isNaN(updatedDt.getTime())) {
          const existing = qidLatestUpdated.get(qid);
          if (!existing || updatedDt > existing) {
            qidLatestUpdated.set(qid, updatedDt);
          }
        }
      } catch { /* skip */ }
    }
  }

  let rowNum = 6;
  const sortedGroups = [...groupQids.keys()].sort();

  for (const groupPerson of sortedGroups) {
    const qids = groupQids.get(groupPerson)!;
    const sortedQids = [...qids].sort((a, b) => (qidToTitle.get(a) || "").localeCompare(qidToTitle.get(b) || ""));

    // Group header row (orange)
    const groupRow = ws.getRow(rowNum);
    for (let col = 1; col <= numCols; col++) {
      const cell = groupRow.getCell(col);
      cell.value = col === 1 ? groupPerson : "";
      cell.fill = GROUP_FILL;
      cell.font = GROUP_FONT;
      cell.alignment = col === 1 ? LEFT_ALIGN : CENTER_ALIGN;
      cell.border = THIN_BORDER;
    }
    rowNum++;

    // Question rows
    for (const qid of sortedQids) {
      const title = qidToTitle.get(qid) || qid;
      const dataRow = ws.getRow(rowNum);

      const tCell = dataRow.getCell(1);
      tCell.value = `    ${title}`;
      tCell.font = { name: "Calibri", size: 10 };
      tCell.alignment = LEFT_ALIGN;
      tCell.border = THIN_BORDER;

      // FY status cell — no "Yet to Start", always show Completed or Pending
      const fyCell = dataRow.getCell(2);
      fyCell.border = THIN_BORDER;
      fyCell.alignment = CENTER_ALIGN;

      if (qidStatus.get(qid)) {
        fyCell.value = "Completed";
        fyCell.font = COMPLETED_FONT;
        fyCell.fill = COMPLETED_FILL;
      } else {
        fyCell.value = pendingLabel;
        fyCell.font = PENDING_FONT;
        fyCell.fill = PENDING_FILL;
      }

      // Last Updated column
      const updatedCell = dataRow.getCell(3);
      updatedCell.border = THIN_BORDER;
      updatedCell.alignment = CENTER_ALIGN;
      updatedCell.font = { name: "Calibri", size: 9 };
      const latestDt = qidLatestUpdated.get(qid);
      if (latestDt) {
        updatedCell.value = formatUpdatedAt(latestDt.toISOString());
      }

      rowNum++;
    }
  }

  // Notes section
  rowNum += 2;
  const notes = [
    { text: "Note:", bold: true, italic: false },
    { text: `"${pendingLabel}" represents that this question is not completed or not sent for review.`, bold: false, italic: true },
    { text: '"Completed" represents that the question for the year is completed.', bold: false, italic: true },
  ];
  for (const note of notes) {
    ws.mergeCells(rowNum, 1, rowNum, numCols);
    const cell = ws.getCell(rowNum, 1);
    cell.value = note.text;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { name: "Calibri", bold: note.bold, italic: note.italic, size: note.bold ? 10 : 9 };
    rowNum++;
  }

  // Column widths
  ws.getColumn(1).width = 45;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 22;

  // Freeze panes
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 5, topLeftCell: "B6", activeCell: "B6" }];
}

export async function generateExcel(
  monthlyRows: CsvRow[],
  company: string,
  report: string,
  bu: string,
  yearlyRows?: CsvRow[]
): Promise<Buffer> {
  const today = new Date();
  const todayDisplay = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const filteredMonthly = monthlyRows.filter(
    r => r.company_name?.trim() === company && r.report?.trim() === report && r.bu_name?.trim() === bu
  );

  const filteredYearly = (yearlyRows || []).filter(
    r => r.company_name?.trim() === company && r.report?.trim() === report && r.bu_name?.trim() === bu
  );

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Monthly Data Lock Pending
  if (filteredMonthly.length > 0) {
    const fyMonths = getFyMonths(filteredMonthly[0]?.data_start_date || "");
    const ws1 = wb.addWorksheet("Data Lock Pending");
    writeMonthlySheet(ws1, "Data Owner", "assignee", "monthly_question_status", "Data Lock Pending", filteredMonthly, fyMonths, bu, today, todayDisplay);

    // Sheet 2: Monthly Data Approval Pending
    const ws2 = wb.addWorksheet("Data Approval Pending");
    writeMonthlySheet(ws2, "Data Reviewer", "u_reviewer", "monthly_approval_status", "Data Approval Pending", filteredMonthly, fyMonths, bu, today, todayDisplay);
  }

  // Sheet 3: Yearly Data Lock Pending
  if (filteredYearly.length > 0) {
    const ws3 = wb.addWorksheet("Yearly Data Lock Pending");
    writeYearlySheet(ws3, "Data Owner", "assignee", "question_status", "Data Lock Pending", filteredYearly, bu, todayDisplay);

    // Sheet 4: Yearly Data Approval Pending
    const ws4 = wb.addWorksheet("Yearly Data Approval Pending");
    writeYearlySheet(ws4, "Data Reviewer", "u_reviewer", "approval_status", "Data Approval Pending", filteredYearly, bu, todayDisplay);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
