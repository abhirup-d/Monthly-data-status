"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Building2, FileText, Layers, Calendar, CalendarDays } from "lucide-react";
import type { Summary } from "@/lib/types";

interface StatsBarProps {
  summary: Summary;
}

export function StatsBar({ summary }: StatsBarProps) {
  const stats = [
    { label: "Companies", value: summary.totalCompanies, icon: Building2 },
    { label: "Reports", value: summary.totalReports, icon: FileText },
    { label: "Business Units", value: summary.totalBUs, icon: Layers },
    { label: "Monthly Completeness", value: `${summary.overallCompleteness}%`, icon: Calendar },
    { label: "Yearly Completeness", value: `${summary.overallYearlyCompleteness}%`, icon: CalendarDays },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
