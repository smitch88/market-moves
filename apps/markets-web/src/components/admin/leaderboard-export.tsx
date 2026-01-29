"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@vault/ui";
import { Download, Loader2, FileSpreadsheet, FileJson } from "lucide-react";

interface LeaderboardExportProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function LeaderboardExport({
  variant = "outline",
  size = "default",
}: LeaderboardExportProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [sortBy, setSortBy] = useState<"xp" | "pnl" | "volume">("xp");
  const [limit, setLimit] = useState("1000");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams({
        format,
        sortBy,
        limit,
      });

      const response = await fetch(`/api/admin/leaderboard/export?${params}`);

      if (!response.ok) {
        throw new Error("Failed to export leaderboard");
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `vault-leaderboard.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setDialogOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export leaderboard. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setDialogOpen(true)}>
        <Download className="h-4 w-4 mr-2" />
        Export Leaderboard
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Leaderboard Snapshot
            </DialogTitle>
            <DialogDescription>
              Download a snapshot of the current leaderboard with user data
              including Twitter IDs, XP, PnL, and more.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as "csv" | "json")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        CSV (Excel)
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        JSON
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as "xp" | "pnl" | "volume")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xp">XP (Highest)</SelectItem>
                    <SelectItem value="pnl">PnL (Highest)</SelectItem>
                    <SelectItem value="volume">Volume (Highest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Max Users</Label>
              <Input
                id="limit"
                type="number"
                min="1"
                max="10000"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of users to include (up to 10,000)
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Export includes:</p>
              <ul className="text-muted-foreground text-xs space-y-1">
                <li>• User ID, Twitter ID, Handle, Name, Email</li>
                <li>• XP, Realized PnL, Total Volume, Balance</li>
                <li>• Total Bets, Positions, Verified Tweets</li>
                <li>• Account Creation Date</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? "Exporting..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
