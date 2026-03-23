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

function computeMonthlyCompleteness(rows: CsvRow[], today: Date): { completeness: number; total: number; completed: number } {
  const fyMonths = getFyMonths(rows[0]?.data_start_date || "");
  const questionIds = new Set(rows.map(r => r.question_id));
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

function computeYearlyCompleteness(rows: CsvRow[]): { completeness: number; total: number; completed: number } {
  // Dedup by question_id: if ANY row for a question_id has COMPLETED, count as completed
  const qidStatus = new Map<string, boolean>();

  for (const row of rows) {
    const qid = (row.question_id || "").trim();
    const isCompleted = (row.question_status || "").trim() === "COMPLETED";
    if (!qidStatus.has(qid)) {
      qidStatus.set(qid, isCompleted);
    } else if (isCompleted) {
      qidStatus.set(qid, true);
    }
  }

  let total = 0;
  let completed = 0;
  for (const isCompleted of qidStatus.values()) {
    total++;
    if (isCompleted) completed++;
  }

  const completeness = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  return { completeness, total, completed };
}

type NestedMap = Map<string, Map<string, Map<string, CsvRow[]>>>;

function groupRows(rows: CsvRow[]): NestedMap {
  const companyMap: NestedMap = new Map();
  for (const row of rows) {
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
  return companyMap;
}

export function processCSV(rows: CsvRow[]): ProcessResult {
  const today = new Date();

  const monthlyRows = rows.filter(r => r.reporting_frequency === "MONTHLY");
  const yearlyRows = rows.filter(r => r.reporting_frequency === "YEARLY");

  const monthlyMap = groupRows(monthlyRows);
  const yearlyMap = groupRows(yearlyRows);

  // Collect all unique company > report > bu keys from both
  const allKeys = new Map<string, Map<string, Set<string>>>();
  for (const map of [monthlyMap, yearlyMap]) {
    for (const [company, reportMap] of map) {
      if (!allKeys.has(company)) allKeys.set(company, new Map());
      const rMap = allKeys.get(company)!;
      for (const [report, buMap] of reportMap) {
        if (!rMap.has(report)) rMap.set(report, new Set());
        const bSet = rMap.get(report)!;
        for (const bu of buMap.keys()) bSet.add(bu);
      }
    }
  }

  const companies: CompanyNode[] = [];
  let totalBUs = 0;
  let totalReports = 0;
  let allMonthlyTotal = 0, allMonthlyCompleted = 0;
  let allYearlyTotal = 0, allYearlyCompleted = 0;

  for (const [companyName, reportMap] of [...allKeys.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const reports: ReportNode[] = [];
    let companyMonthlyTotal = 0, companyMonthlyCompleted = 0;
    let companyYearlyTotal = 0, companyYearlyCompleted = 0;

    for (const [reportName, buSet] of [...reportMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const bus: BuNode[] = [];
      let reportMonthlyTotal = 0, reportMonthlyCompleted = 0;
      let reportYearlyTotal = 0, reportYearlyCompleted = 0;
      totalReports++;

      for (const buName of [...buSet].sort()) {
        const monthlyBuRows = monthlyMap.get(companyName)?.get(reportName)?.get(buName) || [];
        const yearlyBuRows = yearlyMap.get(companyName)?.get(reportName)?.get(buName) || [];

        const mStats = monthlyBuRows.length > 0
          ? computeMonthlyCompleteness(monthlyBuRows, today)
          : { completeness: 0, total: 0, completed: 0 };

        const yStats = yearlyBuRows.length > 0
          ? computeYearlyCompleteness(yearlyBuRows)
          : { completeness: 0, total: 0, completed: 0 };

        bus.push({
          name: buName,
          completeness: mStats.completeness,
          totalQuestions: mStats.total,
          completedQuestions: mStats.completed,
          yearlyCompleteness: yStats.completeness,
          yearlyTotal: yStats.total,
          yearlyCompleted: yStats.completed,
        });

        reportMonthlyTotal += mStats.total;
        reportMonthlyCompleted += mStats.completed;
        reportYearlyTotal += yStats.total;
        reportYearlyCompleted += yStats.completed;
        totalBUs++;
      }

      const reportCompleteness = reportMonthlyTotal > 0
        ? Math.round((reportMonthlyCompleted / reportMonthlyTotal) * 1000) / 10 : 0;
      const reportYearlyCompleteness = reportYearlyTotal > 0
        ? Math.round((reportYearlyCompleted / reportYearlyTotal) * 1000) / 10 : 0;

      reports.push({ name: reportName, completeness: reportCompleteness, yearlyCompleteness: reportYearlyCompleteness, bus });

      companyMonthlyTotal += reportMonthlyTotal;
      companyMonthlyCompleted += reportMonthlyCompleted;
      companyYearlyTotal += reportYearlyTotal;
      companyYearlyCompleted += reportYearlyCompleted;
    }

    const companyCompleteness = companyMonthlyTotal > 0
      ? Math.round((companyMonthlyCompleted / companyMonthlyTotal) * 1000) / 10 : 0;
    const companyYearlyCompleteness = companyYearlyTotal > 0
      ? Math.round((companyYearlyCompleted / companyYearlyTotal) * 1000) / 10 : 0;

    companies.push({ name: companyName, completeness: companyCompleteness, yearlyCompleteness: companyYearlyCompleteness, reports });

    allMonthlyTotal += companyMonthlyTotal;
    allMonthlyCompleted += companyMonthlyCompleted;
    allYearlyTotal += companyYearlyTotal;
    allYearlyCompleted += companyYearlyCompleted;
  }

  const overallCompleteness = allMonthlyTotal > 0 ? Math.round((allMonthlyCompleted / allMonthlyTotal) * 1000) / 10 : 0;
  const overallYearlyCompleteness = allYearlyTotal > 0 ? Math.round((allYearlyCompleted / allYearlyTotal) * 1000) / 10 : 0;

  return {
    companies,
    summary: {
      totalCompanies: companies.length,
      totalReports,
      totalBUs,
      overallCompleteness,
      overallYearlyCompleteness,
    },
  };
}
