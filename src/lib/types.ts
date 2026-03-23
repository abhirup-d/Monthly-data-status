export interface CsvRow {
  company_name: string;
  bu_name: string;
  report: string;
  assignee: string;
  u_reviewer: string;
  question_id: string;
  title: string;
  monthly_question_status: string;
  monthly_approval_status: string;
  month_detail: string;
  month_updated_at: string;
  data_start_date: string;
  data_end_date: string;
  reporting_frequency: string;
}

export interface BuNode {
  name: string;
  completeness: number;
  totalQuestions: number;
  completedQuestions: number;
}

export interface ReportNode {
  name: string;
  completeness: number;
  bus: BuNode[];
}

export interface CompanyNode {
  name: string;
  completeness: number;
  reports: ReportNode[];
}

export interface Summary {
  totalCompanies: number;
  totalReports: number;
  totalBUs: number;
  overallCompleteness: number;
}

export interface ProcessResult {
  companies: CompanyNode[];
  summary: Summary;
}

export interface Selection {
  company: string;
  report: string;
  bu: string;
}
