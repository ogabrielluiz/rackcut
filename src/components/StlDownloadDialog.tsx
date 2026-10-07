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
import { parseSurfacePattern } from "@/lib/surfaces/fields";
import {
  DEFAULT_PRINT_THICKNESS,
  DEFAULT_PATTERN_HEIGHT,
  DEFAULT_RELIEF_HEIGHT,
  PANEL_THICKNESS_PRESETS,
} from "@/lib/constants";

/** Layer height the step count in the relief hint is quoted for (mm) */
const REFERENCE_LAYER = 0.2;

interface StlDownloadDialogProps {
  panels: PlacedPanel[];
  disabled?: boolean;
  engraveMode: "extrude" | "recess";
}

export default function StlDownloadDialog({ panels, disabled, engraveMode }: StlDownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const [thickness, setThickness] = useState(DEFAULT_PRINT_THICKNESS);
  const [patternHeight, setPatternHeight] = useState(DEFAULT_PATTERN_HEIGHT);
  const [reliefHeight, setReliefHeight] = useState(DEFAULT_RELIEF_HEIGHT);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = panels.map((panel) => parseSurfacePattern(panel.pattern)?.style);
  const hasRelief = styles.includes("relief");
  const hasBands = styles.includes("bands");
  // Relief has its own height; every other pattern uses the pattern height
  const usesPatternHeight = panels.some((panel, i) => panel.pattern !== "none" && styles[i] !== "relief");
  const allRelief = hasRelief && !usesPatternHeight;
  // Tallest thing raised on any panel; 0 when every panel is plain
  const raised = Math.max(hasRelief ? reliefHeight : 0, usesPatternHeight ? patternHeight : 0);

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
        engraveMode,
        reliefHeight
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
              step={0.1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 1 && v <= 10) setThickness(v);
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {PANEL_THICKNESS_PRESETS.map(({ mm, label }) => (
                <button
                  key={mm}
                  type="button"
                  aria-pressed={thickness === mm}
                  onClick={() => setThickness(mm)}
                  className={`h-7 px-2 rounded-sm border text-[11px] transition-colors ${
                    thickness === mm
                      ? "border-primary text-primary"
                      : "border-input text-muted-foreground/70 hover:text-muted-foreground"
                  }`}
                >
                  {mm} mm · {label}
                </button>
              ))}
            </div>
          </div>

          {!allRelief && (
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
            {hasBands && (
              <span className="text-[10px] text-muted-foreground/50">
                Two-tone bands: switch filament at the first layer above {thickness} mm
              </span>
            )}
          </div>
          )}

          {hasRelief && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stl-relief-height">Relief height (mm)</Label>
              <Input
                id="stl-relief-height"
                type="number"
                value={reliefHeight}
                min={0.2}
                max={3}
                step={0.1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0.2 && v <= 3) setReliefHeight(v);
                }}
              />
              <span className="text-[10px] text-muted-foreground/50">
                Printed face up, relief builds in layer steps: {Math.round(reliefHeight / REFERENCE_LAYER)} at {REFERENCE_LAYER} mm layers.
                Finer layers give a smoother surface.
              </span>
            </div>
          )}

          {raised > 0 && (
            <div className="text-xs text-muted-foreground/50">
              Highest point of the print: {Number((thickness + raised).toFixed(2))} mm
            </div>
          )}

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
