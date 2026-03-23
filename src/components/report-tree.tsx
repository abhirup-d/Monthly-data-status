"use client";

import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Download, Building2, FileText, Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { CompanyNode, Selection } from "@/lib/types";

interface ReportTreeProps {
  companies: CompanyNode[];
  selections: Set<string>;
  onSelectionChange: (selections: Set<string>) => void;
  onDownloadSingle: (selection: Selection) => void;
  isGenerating: boolean;
}

function selectionKey(company: string, report: string, bu: string): string {
  return `${company}|||${report}|||${bu}`;
}

function parseSelectionKey(key: string): Selection {
  const [company, report, bu] = key.split("|||");
  return { company, report, bu };
}

function completenessBadge(pct: number) {
  const variant = pct >= 80 ? "default" : pct >= 50 ? "secondary" : "destructive";
  const bg = pct >= 80 ? "bg-green-100 text-green-800 hover:bg-green-100" : pct >= 50 ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" : "bg-red-100 text-red-800 hover:bg-red-100";
  return <Badge variant={variant} className={`text-xs ${bg}`}>{pct}%</Badge>;
}

export function ReportTree({ companies, selections, onSelectionChange, onDownloadSingle, isGenerating }: ReportTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const allKeys = companies.flatMap(c =>
    c.reports.flatMap(r =>
      r.bus.map(b => selectionKey(c.name, r.name, b.name))
    )
  );

  const allSelected = allKeys.length > 0 && allKeys.every(k => selections.has(k));
  const someSelected = allKeys.some(k => selections.has(k));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allKeys));
    }
  };

  const toggleCompany = (company: CompanyNode) => {
    const companyKeys = company.reports.flatMap(r =>
      r.bus.map(b => selectionKey(company.name, r.name, b.name))
    );
    const allChecked = companyKeys.every(k => selections.has(k));
    const next = new Set(selections);
    for (const k of companyKeys) {
      if (allChecked) next.delete(k); else next.add(k);
    }
    onSelectionChange(next);
  };

  const toggleReport = (companyName: string, report: { name: string; bus: { name: string }[] }) => {
    const reportKeys = report.bus.map(b => selectionKey(companyName, report.name, b.name));
    const allChecked = reportKeys.every(k => selections.has(k));
    const next = new Set(selections);
    for (const k of reportKeys) {
      if (allChecked) next.delete(k); else next.add(k);
    }
    onSelectionChange(next);
  };

  const toggleBu = (key: string) => {
    const next = new Set(selections);
    if (next.has(key)) next.delete(key); else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div className="border border-border rounded-lg">
      {/* Select All header */}
      <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30">
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onCheckedChange={toggleAll}
        />
        <span className="text-sm font-medium">
          {allSelected ? "Deselect All" : "Select All"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {selections.size} of {allKeys.length} selected
        </span>
      </div>

      {/* Tree */}
      <div className="divide-y divide-border">
        {companies.map((company) => {
          const companyKey = `company:${company.name}`;
          const isExpanded = expanded.has(companyKey);
          const companyBuKeys = company.reports.flatMap(r => r.bus.map(b => selectionKey(company.name, r.name, b.name)));
          const companyAllChecked = companyBuKeys.every(k => selections.has(k));
          const companySomeChecked = companyBuKeys.some(k => selections.has(k));

          return (
            <div key={company.name}>
              {/* Company row */}
              <div className="flex items-center gap-2 p-3 hover:bg-muted/30 transition-colors">
                <Checkbox
                  checked={companyAllChecked}
                  indeterminate={!companyAllChecked && companySomeChecked}
                  onCheckedChange={() => toggleCompany(company)}
                />
                <button onClick={() => toggleExpand(companyKey)} className="p-0.5">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium flex-1">{company.name}</span>
                {completenessBadge(company.completeness)}
              </div>

              {/* Reports */}
              {isExpanded && company.reports.map((report) => {
                const reportKey = `report:${company.name}:${report.name}`;
                const isReportExpanded = expanded.has(reportKey);
                const reportBuKeys = report.bus.map(b => selectionKey(company.name, report.name, b.name));
                const reportAllChecked = reportBuKeys.every(k => selections.has(k));
                const reportSomeChecked = reportBuKeys.some(k => selections.has(k));

                return (
                  <div key={report.name}>
                    {/* Report row */}
                    <div className="flex items-center gap-2 p-3 pl-10 hover:bg-muted/30 transition-colors">
                      <Checkbox
                        checked={reportAllChecked}
                      indeterminate={!reportAllChecked && reportSomeChecked}
                        onCheckedChange={() => toggleReport(company.name, report)}
                      />
                      <button onClick={() => toggleExpand(reportKey)} className="p-0.5">
                        {isReportExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span className="text-sm flex-1">{report.name}</span>
                      {completenessBadge(report.completeness)}
                    </div>

                    {/* BUs */}
                    {isReportExpanded && report.bus.map((bu) => {
                      const buKey = selectionKey(company.name, report.name, bu.name);
                      const isChecked = selections.has(buKey);

                      return (
                        <div key={bu.name} className="flex items-center gap-2 p-3 pl-20 hover:bg-muted/30 transition-colors">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleBu(buKey)}
                          />
                          <Layers className="h-4 w-4 text-orange-500" />
                          <span className="text-sm flex-1">{bu.name}</span>
                          <span className="text-xs text-muted-foreground mr-2">
                            {bu.completedQuestions}/{bu.totalQuestions}
                          </span>
                          {completenessBadge(bu.completeness)}
                          <button
                            onClick={() => onDownloadSingle(parseSelectionKey(buKey))}
                            disabled={isGenerating}
                            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                            title="Download this report"
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { selectionKey, parseSelectionKey };
