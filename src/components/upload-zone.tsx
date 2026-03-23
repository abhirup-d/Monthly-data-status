"use client";

import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
  fileName: string | null;
  onClear: () => void;
}

export function UploadZone({ onFileUpload, isProcessing, fileName, onClear }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        onFileUpload(file);
      }
    },
    [onFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileUpload(file);
      e.target.value = "";
    },
    [onFileUpload]
  );

  if (fileName) {
    return (
      <div className="border border-border rounded-lg p-4 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium">{fileName}</span>
        </div>
        <button
          onClick={onClear}
          className="p-1 rounded-md hover:bg-muted transition-colors"
          title="Clear file"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      onClick={() => document.getElementById("csv-upload")?.click()}
    >
      <input
        id="csv-upload"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileInput}
      />
      <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm font-medium mb-1">
        {isProcessing ? "Processing..." : "Drop your CSV file here or click to browse"}
      </p>
      <p className="text-xs text-muted-foreground">
        ReportDataSubmissionProgress.csv
      </p>
    </div>
  );
}
