import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PlacedPanel } from "@/lib/types";
import { generatePatternGeometry } from "@/lib/pattern-geometry";
import { generateAllPanelsStlZip } from "@/lib/renderers/stl-renderer";

interface StlDownloadDialogProps {
  panels: PlacedPanel[];
  disabled?: boolean;
  engraveMode: "extrude" | "recess";
}

export default function StlDownloadDialog({ panels, disabled, engraveMode }: StlDownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const [thickness, setThickness] = useState(3);
  const [patternHeight, setPatternHeight] = useState(0.5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    let url: string | null = null;
    try {
      const zip = await generateAllPanelsStlZip(
        panels,
        thickness,
        patternHeight,
        (panel) => generatePatternGeometry(panel.pattern, panel.spec.width, panel.spec.height, panel.patternSeed),
        engraveMode
      );

      url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rackcut-panels.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setOpen(false);
    } catch (e) {
      console.error("STL generation failed:", e);
      setError(e instanceof Error ? e.message : "STL generation failed. Try a simpler pattern or fewer panels.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} variant="outline">
          Download STL
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>3D Print Settings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs">
            Each panel will be exported as a separate STL file in a ZIP archive.
            Patterns are extruded as raised geometry on the panel surface.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stl-thickness">Panel thickness (mm)</Label>
            <Input
              id="stl-thickness"
              type="number"
              value={thickness}
              min={1}
              max={10}
              step={0.5}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= 10) setThickness(v);
              }}
            />
            <span className="text-[10px] text-muted-foreground/50">Common: 2mm (thin), 3mm (standard), 5mm (sturdy)</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stl-pattern-height">Pattern extrusion height (mm)</Label>
            <Input
              id="stl-pattern-height"
              type="number"
              value={patternHeight}
              min={0.1}
              max={2}
              step={0.1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0.1 && v <= 2) setPatternHeight(v);
              }}
            />
            <span className="text-[10px] text-muted-foreground/50">How much the pattern sticks out above the panel surface</span>
          </div>

          <div className="text-xs text-muted-foreground/50">
            {panels.length} panel{panels.length !== 1 ? "s" : ""} will be generated
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">{error}</p>
          )}

          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Generate & Download ZIP"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
