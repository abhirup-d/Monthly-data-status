"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface DownloadBarProps {
  selectedCount: number;
  onDownload: () => void;
  isGenerating: boolean;
  progress?: string;
}

export function DownloadBar({ selectedCount, onDownload, isGenerating, progress }: DownloadBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {isGenerating && progress ? progress : `${selectedCount} report${selectedCount !== 1 ? "s" : ""} selected`}
        </span>
        <Button onClick={onDownload} disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? "Generating..." : `Download${selectedCount > 1 ? " as ZIP" : ""}`}
        </Button>
      </div>
    </div>
  );
}
