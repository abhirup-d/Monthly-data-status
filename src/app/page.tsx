"use client";

import { useState, useCallback } from "react";
import { UploadZone } from "@/components/upload-zone";
import { StatsBar } from "@/components/stats-bar";
import { ReportTree, selectionKey, parseSelectionKey } from "@/components/report-tree";
import { DownloadBar } from "@/components/download-bar";
import type { ProcessResult, Selection } from "@/lib/types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selections, setSelections] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setIsProcessing(true);
    setResult(null);
    setSelections(new Set());

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const res = await fetch("/api/process", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process file");
      }

      const data: ProcessResult = await res.json();
      setResult(data);

      // Auto-select all
      const allKeys = new Set(
        data.companies.flatMap(c =>
          c.reports.flatMap(r =>
            r.bus.map(b => selectionKey(c.name, r.name, b.name))
          )
        )
      );
      setSelections(allKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setResult(null);
    setSelections(new Set());
    setError(null);
  }, []);

  const handleDownloadSingle = useCallback(async (selection: Selection) => {
    if (!file) return;
    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("selections", JSON.stringify([selection]));

      const res = await fetch("/api/generate", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to generate report");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] || "report.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsGenerating(false);
    }
  }, [file]);

  const handleDownloadSelected = useCallback(async () => {
    if (!file || selections.size === 0) return;
    setIsGenerating(true);
    try {
      const selectionArray: Selection[] = [...selections].map(parseSelectionKey);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("selections", JSON.stringify(selectionArray));

      const res = await fetch("/api/generate", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to generate reports");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] || "reports.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsGenerating(false);
    }
  }, [file, selections]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-[#2F5496]">Monthly Data Status Reports</h1>
          <p className="text-sm text-muted-foreground">Upload CSV, preview data completeness, download Excel reports</p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        <UploadZone
          onFileUpload={handleFileUpload}
          isProcessing={isProcessing}
          fileName={file?.name || null}
          onClear={handleClear}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {isProcessing && (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground mt-2">Processing CSV...</p>
          </div>
        )}

        {result && (
          <>
            <StatsBar summary={result.summary} />
            <ReportTree
              companies={result.companies}
              selections={selections}
              onSelectionChange={setSelections}
              onDownloadSingle={handleDownloadSingle}
              isGenerating={isGenerating}
            />
          </>
        )}
      </main>

      {/* Download bar */}
      <DownloadBar
        selectedCount={selections.size}
        onDownload={handleDownloadSelected}
        isGenerating={isGenerating}
      />
    </div>
  );
}
