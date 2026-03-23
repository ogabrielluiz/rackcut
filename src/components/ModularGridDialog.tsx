import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseModularGridData } from "@/lib/modulargrid";
import type { Format, RackRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModularGridDialogProps {
  onImport: (blanks: { hp: number; format: Format }[]) => void;
}

interface RowResult extends RackRow {
  selected: boolean;
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

const MG_URL_RE =
  /^https:\/\/(www\.)?modulargrid\.net\/e\/racks\/view\/\d+$/;

function isValidMgUrl(url: string): boolean {
  return MG_URL_RE.test(url.trim());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ModularGridDialog({ onImport }: ModularGridDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowResult[] | null>(null);

  // Reset internal state when dialog opens/closes
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetState();
    }
  }

  function resetState() {
    setUrl("");
    setLoading(false);
    setError(null);
    setRows(null);
  }

  const handleImport = useCallback(async () => {
    setError(null);

    // 1. Validate URL
    if (!isValidMgUrl(url)) {
      setError("Invalid URL — must be a valid ModularGrid rack URL");
      return;
    }

    // 2. Check worker is configured
    const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined;
    if (!workerUrl) {
      setError("Worker URL not configured — set VITE_WORKER_URL");
      return;
    }

    // 3. Fetch
    setLoading(true);
    try {
      const response = await fetch(
        `${workerUrl}/parse?url=${encodeURIComponent(url.trim())}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const data = parseModularGridData(html);

      const rowResults: RowResult[] = data.rows.map((row) => ({
        ...row,
        selected: row.blankHp > 0,
      }));

      setRows(rowResults);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch rack data");
      }
    } finally {
      setLoading(false);
    }
  }, [url]);

  function handleToggleRow(index: number) {
    setRows((prev) =>
      prev
        ? prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
        : prev
    );
  }

  function handleAddSelected() {
    if (!rows) return;

    const blanks = rows
      .filter((r) => r.selected && r.blankHp > 0)
      .map((r) => ({ hp: r.blankHp, format: r.format }));

    onImport(blanks);
    setOpen(false);
    resetState();
  }

  const hasSelection = rows?.some((r) => r.selected && r.blankHp > 0) ?? false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Import from ModularGrid</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from ModularGrid</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* URL input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mg-url-input">Rack URL</Label>
            <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="mg-url-input"
              type="url"
              placeholder="https://modulargrid.net/e/racks/view/12345"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="min-w-0"
            />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          {/* Row results */}
          {rows && rows.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Rack rows">
              {rows.map((row, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    id={`row-${i}`}
                    checked={row.selected}
                    disabled={row.blankHp === 0}
                    onChange={() => handleToggleRow(i)}
                  />
                  <label htmlFor={`row-${i}`} className="flex-1">
                    Row {i + 1} — {row.format} — {row.usedHp}HP used —{" "}
                    <strong>{row.blankHp} blank HP</strong>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          {rows ? (
            <Button onClick={handleAddSelected} disabled={!hasSelection}>
              Add Selected
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? "Loading..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
