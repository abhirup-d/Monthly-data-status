import type { CsvRow, CompanyNode, ReportNode, BuNode, ProcessResult } from "./types";

const FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

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
    return FY_MONTH_ORDER.map(m => [2025, m]);
  }
}

function computeBuCompleteness(rows: CsvRow[], today: Date): { completeness: number; total: number; completed: number } {
  const fyMonths = getFyMonths(rows[0]?.data_start_date || "");

  // Get unique question_ids
  const questionIds = new Set(rows.map(r => r.question_id));

  // For each (question_id, month): check if ANY row is COMPLETED
  const qidMonthStatus = new Map<string, boolean>();

  for (const row of rows) {
    const parsed = parseMonthDetail(row.month_detail);
    if (!parsed) continue;
    const [year, month] = parsed;
    const key = `${row.question_id}|${year}|${month}`;
    const isCompleted = row.monthly_question_status === "COMPLETED";
    if (!qidMonthStatus.has(key)) {
      qidMonthStatus.set(key, isCompleted);
    } else if (isCompleted) {
      qidMonthStatus.set(key, true);
    }
  }

  // Count completed vs total for months that have ended
  let total = 0;
  let completed = 0;

  for (const qid of questionIds) {
    for (const [year, month] of fyMonths) {
      if (!isMonthOver(year, month, today)) continue;
      const key = `${qid}|${year}|${month}`;
      total++;
      if (qidMonthStatus.get(key)) completed++;
    }
  }

  const completeness = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  return { completeness, total, completed };
}

export function processCSV(rows: CsvRow[]): ProcessResult {
  const today = new Date();

  // Filter to MONTHLY only
  const monthlyRows = rows.filter(r => r.reporting_frequency === "MONTHLY");

  // Group by company > report > bu
  const companyMap = new Map<string, Map<string, Map<string, CsvRow[]>>>();

  for (const row of monthlyRows) {
    const company = (row.company_name || "").trim();
    const report = (row.report || "").trim();
    const bu = (row.bu_name || "").trim();

    if (!companyMap.has(company)) companyMap.set(company, new Map());
    const reportMap = companyMap.get(company)!;
    if (!reportMap.has(report)) reportMap.set(report, new Map());
    const buMap = reportMap.get(report)!;
    if (!buMap.has(bu)) buMap.set(bu, []);
    buMap.get(bu)!.push(row);
  }

  const companies: CompanyNode[] = [];
  let totalBUs = 0;
  let totalReports = 0;
  let allTotal = 0;
  let allCompleted = 0;

  for (const [companyName, reportMap] of [...companyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const reports: ReportNode[] = [];
    let companyTotal = 0;
    let companyCompleted = 0;

    for (const [reportName, buMap] of [...reportMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const bus: BuNode[] = [];
      let reportTotal = 0;
      let reportCompleted = 0;
      totalReports++;

      for (const [buName, buRows] of [...buMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const stats = computeBuCompleteness(buRows, today);
        bus.push({
          name: buName,
          completeness: stats.completeness,
          totalQuestions: stats.total,
          completedQuestions: stats.completed,
        });
        reportTotal += stats.total;
        reportCompleted += stats.completed;
        totalBUs++;
      }

      const reportCompleteness = reportTotal > 0 ? Math.round((reportCompleted / reportTotal) * 1000) / 10 : 0;
      reports.push({ name: reportName, completeness: reportCompleteness, bus });
      companyTotal += reportTotal;
      companyCompleted += reportCompleted;
    }

    const companyCompleteness = companyTotal > 0 ? Math.round((companyCompleted / companyTotal) * 1000) / 10 : 0;
    companies.push({ name: companyName, completeness: companyCompleteness, reports });
    allTotal += companyTotal;
    allCompleted += companyCompleted;
  }

  const overallCompleteness = allTotal > 0 ? Math.round((allCompleted / allTotal) * 1000) / 10 : 0;

  return {
    companies,
    summary: {
      totalCompanies: companies.length,
      totalReports,
      totalBUs,
      overallCompleteness,
    },
  };
}
