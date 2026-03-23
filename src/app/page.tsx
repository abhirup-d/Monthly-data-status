"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import { UploadZone } from "@/components/upload-zone";
import { StatsBar } from "@/components/stats-bar";
import { ReportTree, selectionKey, parseSelectionKey } from "@/components/report-tree";
import { DownloadBar } from "@/components/download-bar";
import { processCSV } from "@/lib/csv-parser";
import type { ProcessResult, Selection, CsvRow } from "@/lib/types";

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [selections, setSelections] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const csvRowsRef = useRef<CsvRow[]>([]);

  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setFileName(uploadedFile.name);
    setError(null);
    setIsProcessing(true);
    setResult(null);
    setSelections(new Set());

    try {
      const text = await uploadedFile.text();
      const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

      if (parsed.data.length === 0) {
        throw new Error("No data found in CSV");
      }

      const monthlyRows = parsed.data.filter(r => r.reporting_frequency === "MONTHLY");
      csvRowsRef.current = monthlyRows;

      const data = processCSV(parsed.data);
      setResult(data);

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
    setFileName(null);
    setResult(null);
    setSelections(new Set());
    setError(null);
    setGenerateProgress("");
    csvRowsRef.current = [];
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateSingleExcel = async (selection: Selection): Promise<ArrayBuffer> => {
    const filtered = csvRowsRef.current.filter(
      r => r.company_name?.trim() === selection.company &&
           r.report?.trim() === selection.report &&
           r.bu_name?.trim() === selection.bu
    );

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: filtered, selections: [selection] }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to generate report");
    }

    return res.arrayBuffer();
  };

  const handleDownloadSingle = useCallback(async (selection: Selection) => {
    if (csvRowsRef.current.length === 0) return;
    setIsGenerating(true);
    setError(null);
    try {
      const buffer = await generateSingleExcel(selection);
      const today = new Date();
      const todayStr = `${String(today.getDate()).padStart(2, "0")}_${String(today.getMonth() + 1).padStart(2, "0")}_${today.getFullYear()}`;
      const safeBu = selection.bu.replace(/[/\\:*?"<>|]/g, "_");
      const filename = `${safeBu} Monthly Data Status ${todayStr}.xlsx`;
      downloadBlob(new Blob([buffer]), filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsGenerating(false);
      setGenerateProgress("");
    }
  }, []);

  const handleDownloadSelected = useCallback(async () => {
    if (csvRowsRef.current.length === 0 || selections.size === 0) return;
    setIsGenerating(true);
    setError(null);

    const selectionArray: Selection[] = [...selections].map(parseSelectionKey);

    // Single file — no ZIP needed
    if (selectionArray.length === 1) {
      await handleDownloadSingle(selectionArray[0]);
      return;
    }

    try {
      const today = new Date();
      const todayStr = `${String(today.getDate()).padStart(2, "0")}_${String(today.getMonth() + 1).padStart(2, "0")}_${today.getFullYear()}`;
      const zip = new JSZip();

      for (let i = 0; i < selectionArray.length; i++) {
        const sel = selectionArray[i];
        setGenerateProgress(`Generating ${i + 1} of ${selectionArray.length}...`);

        const buffer = await generateSingleExcel(sel);
        const safeCompany = sel.company.replace(/[/\\:*?"<>|]/g, "_");
        const safeReport = sel.report.replace(/[/\\:*?"<>|]/g, "_");
        const safeBu = sel.bu.replace(/[/\\:*?"<>|]/g, "_");
        const filename = `${safeBu} Monthly Data Status ${todayStr}.xlsx`;
        zip.file(`${safeCompany}/${safeReport}/${filename}`, buffer);
      }

      setGenerateProgress("Creating ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `Monthly Data Status Reports ${todayStr}.zip`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsGenerating(false);
      setGenerateProgress("");
    }
  }, [selections, handleDownloadSingle]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-[#2F5496]">Monthly Data Status Reports</h1>
          <p className="text-sm text-muted-foreground">Upload CSV, preview data completeness, download Excel reports</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        <UploadZone
          onFileUpload={handleFileUpload}
          isProcessing={isProcessing}
          fileName={fileName}
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

      <DownloadBar
        selectedCount={selections.size}
        onDownload={handleDownloadSelected}
        isGenerating={isGenerating}
        progress={generateProgress}
      />
    </div>
  );
}
