import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PanelForm from "@/components/PanelForm";
import PanelList from "@/components/PanelList";
import SvgPreview from "@/components/SvgPreview";
import ModularGridDialog from "@/components/ModularGridDialog";
import PatternPreview from "@/components/PatternPreview";
import { computePanel, layoutPanels, splitBlank } from "@/lib/panel";
import { SORTED_PATTERN_ENTRIES } from "@/lib/patterns";
import { generateSvg, downloadSvg } from "@/lib/svg";
import { DEFAULT_GAP, MIN_GAP, MAX_GAP, DEFAULT_MAX_BLANK_HP } from "@/lib/constants";
import type { PanelEntry, Format, HoleStyle, SplitMode, PatternType, MaterialType, OutputMode } from "@/lib/types";
import { MATERIAL_CONFIG } from "@/components/SvgPreview";
import StlDownloadDialog from "@/components/StlDownloadDialog";
import StlViewer from "@/components/StlViewer";
import { generatePanelStl } from "@/lib/renderers/stl-renderer";
import { generatePatternGeometry } from "@/lib/pattern-geometry";
import faviconUrl from "/favicon.svg?url";

function App() {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [gap, setGap] = useState(DEFAULT_GAP);
  const [maxBlankHp, setMaxBlankHp] = useState(DEFAULT_MAX_BLANK_HP);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [globalPattern, setGlobalPattern] = useState<PatternType>("none");
  const [material, setMaterial] = useState<MaterialType>("mdf");
  const [outputMode, setOutputMode] = useState<OutputMode>("laser-cut");
  const [printColor, setPrintColor] = useState("#cccccc");
  const [stlPreview, setStlPreview] = useState<ArrayBuffer | null>(null);
  const [stlGenerating, setStlGenerating] = useState(false);
  const [stlPreviewError, setStlPreviewError] = useState<string | null>(null);
  const [previewPanelIndex, setPreviewPanelIndex] = useState(0);
  const [previewTab, setPreviewTab] = useState<"2d" | "3d">("2d");

  function handleAdd(panel: {
    hp: number;
    format: Format;
    holeStyle: HoleStyle;
    quantity: number;
  }) {
    const hpValues = splitBlank(panel.hp, maxBlankHp, splitMode);
    const entries: PanelEntry[] = hpValues.map((hp) => ({
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      hp,
      format: panel.format,
      holeStyle: panel.holeStyle,
      quantity: panel.quantity,
      pattern: globalPattern,
      patternSeed: Math.floor(Math.random() * 1000000),
    }));
    setPanels((prev) => [...prev, ...entries]);
  }

  function handleUpdatePanel(id: string, updates: Partial<PanelEntry>) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }

  function handleRemove(id: string) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }

  function handleRandomizeSeed(id: string) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, patternSeed: Math.floor(Math.random() * 1000000) } : p))
    );
  }

  function handleDuplicate(id: string) {
    setPanels((prev) => {
      const source = prev.find((p) => p.id === id);
      if (!source) return prev;
      const copy: PanelEntry = { ...source, id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) };
      const idx = prev.indexOf(source);
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }

  function handleClear() {
    setPanels([]);
  }

  function handleGapChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= MIN_GAP && val <= MAX_GAP) {
      setGap(val);
    }
  }

  const handleModularGridImport = useCallback(
    (blanks: { hp: number; format: Format }[]) => {
      const entries: PanelEntry[] = blanks.flatMap((b) => {
        const hpValues = splitBlank(b.hp, maxBlankHp, splitMode);
        return hpValues.map((hp) => ({
          id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
          hp,
          format: b.format,
          holeStyle: "slot" as HoleStyle,
          quantity: 1,
          pattern: globalPattern,
          patternSeed: Math.floor(Math.random() * 1000000),
        }));
      });
      setPanels((prev) => [...prev, ...entries]);
    },
    [maxBlankHp, splitMode, globalPattern]
  );

  const layoutResult = useMemo(() => {
    const inputs = panels.flatMap((entry) => {
      const spec = computePanel(entry.hp, entry.format, entry.holeStyle);
      return Array.from({ length: entry.quantity }, () => ({
        spec,
        pattern: entry.pattern,
        patternSeed: entry.patternSeed,
      }));
    });
    return layoutPanels(inputs, gap);
  }, [panels, gap]);

  // Clamp preview index when panels change
  const clampedIndex = Math.min(previewPanelIndex, Math.max(0, layoutResult.placed.length - 1));
  if (clampedIndex !== previewPanelIndex) setPreviewPanelIndex(clampedIndex);

  // Auto-generate 3D preview for the selected panel when 3D tab is active
  const previewPanel = layoutResult.placed[clampedIndex] ?? null;
  const stlPreviewKey = previewTab === "3d" && previewPanel
    ? `${clampedIndex}-${previewPanel.spec.hp}-${previewPanel.pattern}-${previewPanel.patternSeed}-${outputMode}`
    : null;

  useEffect(() => {
    if (!stlPreviewKey || previewTab !== "3d" || !previewPanel) {
      setStlPreview(null);
      return;
    }

    let cancelled = false;
    setStlPreview(null);
    setStlGenerating(true);
    setStlPreviewError(null);

    // Delay to let React render the loading state before blocking the main thread
    const timeout = setTimeout(() => {
      const geo = generatePatternGeometry(previewPanel.pattern, previewPanel.spec.width, previewPanel.spec.height, previewPanel.patternSeed);
      const engrave = outputMode === "laser-cut" ? "recess" as const : "extrude" as const;
      generatePanelStl(previewPanel, 3, 0.5, geo, engrave)
        .then((stl) => { if (!cancelled) setStlPreview(stl); })
        .catch((e) => {
          if (!cancelled) setStlPreviewError(e instanceof Error ? e.message : "3D preview failed");
        })
        .finally(() => { if (!cancelled) setStlGenerating(false); });
    }, 50);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [stlPreviewKey, previewTab, previewPanel]);

  function handleDownload() {
    const svgString = generateSvg(
      layoutResult.placed,
      layoutResult.sheetWidth,
      layoutResult.sheetHeight
    );
    downloadSvg(svgString, "rackcut.svg");
  }

  const totalPanelCount = panels.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-border px-4 py-4 sm:px-6 sm:py-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img src={faviconUrl} alt="rackcut logo" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" />
            <div>
              <h1 className="text-primary text-xl sm:text-2xl font-bold tracking-tight">rackcut</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Generate laser-cut SVG files for Eurorack blank panels with generative engrave patterns.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Notice banner */}
      <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 sm:px-6">
        <p className="max-w-5xl mx-auto text-xs text-primary/80">
          <span className="font-semibold">New:</span> 3D Print mode is here! Export STL files with raised patterns, preview in 3D, and pick your filament color.
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-6 flex flex-col gap-6 sm:gap-8">
        {/* 1. Add Panels */}
        <section>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-3">
            <h2 className="text-primary text-sm font-semibold uppercase tracking-wider">1. Add Panels</h2>
            <span className="text-muted-foreground/50 text-xs">Manually or import from ModularGrid</span>
          </div>
          <div className="flex flex-wrap items-end gap-4 border border-border rounded-sm bg-card/30 p-4">
            <PanelForm onAdd={handleAdd} />
            <div className="h-8 w-px bg-border hidden sm:block" />
            <ModularGridDialog onImport={handleModularGridImport} />
          </div>
        </section>

        {/* 2. Configure */}
        <section>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-3">
            <h2 className="text-primary text-sm font-semibold uppercase tracking-wider">2. Configure</h2>
            <span className="text-muted-foreground/50 text-xs">Sheet layout, auto-splitting, and default pattern for new panels</span>
          </div>
          <div className="flex flex-wrap items-start gap-5 border border-border rounded-sm bg-card/30 p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="gap-input" className="text-xs">Gap (mm)</Label>
              <Input
                id="gap-input"
                type="number"
                value={gap}
                min={MIN_GAP}
                max={MAX_GAP}
                step={0.5}
                className="w-20"
                onChange={handleGapChange}
                title="Space between panels on the cut sheet"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="max-blank-hp" className="text-xs">Max HP</Label>
              <Input
                id="max-blank-hp"
                type="number"
                value={maxBlankHp}
                min={1}
                max={128}
                className="w-20"
                title="Panels larger than this will be split"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= 128) {
                    setMaxBlankHp(val);
                  }
                }}
              />
              <span className="text-[10px] text-muted-foreground/40">splits larger</span>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="split-mode" className="text-xs">Split mode</Label>
              <select
                id="split-mode"
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                className="h-9 rounded-sm border border-input bg-secondary px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                title="Equal: same-sized panels. Fill max: maximum size first, remainder last."
              >
                <option value="equal">Equal sizes</option>
                <option value="fill-max">Fill max first</option>
              </select>
            </div>

            <div className="h-8 w-px bg-border hidden sm:block" />

            <div className="flex flex-col gap-1">
              <Label htmlFor="pattern" className="text-xs">Default pattern</Label>
              <div className="flex gap-1.5">
                <select
                  id="pattern"
                  value={globalPattern}
                  onChange={(e) => setGlobalPattern(e.target.value as PatternType)}
                  className="h-9 rounded-sm border border-input bg-secondary px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  title="Pattern applied to newly added panels"
                >
                  {SORTED_PATTERN_ENTRIES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {panels.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs whitespace-nowrap"
                    title="Apply this pattern to all existing panels"
                    onClick={() => setPanels((prev) => prev.map((p) => ({ ...p, pattern: globalPattern })))}
                  >
                    Apply to all
                  </Button>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/40">for new panels</span>
            </div>

            <div className="h-8 w-px bg-border hidden sm:block" />

            <PatternPreview />
          </div>
        </section>

        {/* 3. Your Panels */}
        <section>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-3">
            <h2 className="text-primary text-sm font-semibold uppercase tracking-wider">3. Your Panels</h2>
            {panels.length > 0 ? (
              <span className="text-muted-foreground/50 text-xs">
                {panels.length} {panels.length === 1 ? "panel" : "panels"}, {totalPanelCount} total on sheet &middot; edit any field inline
              </span>
            ) : (
              <span className="text-muted-foreground/50 text-xs">No panels yet &mdash; add panels above to get started</span>
            )}
          </div>
          {panels.length > 0 && (
            <PanelList
              panels={panels}
              onUpdatePanel={handleUpdatePanel}
              onRandomizeSeed={handleRandomizeSeed}
              onDuplicate={handleDuplicate}
              onRemove={handleRemove}
              onClear={handleClear}
            />
          )}
        </section>

        {/* 4. Preview & Download */}
        <section>
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="text-primary text-sm font-semibold uppercase tracking-wider">4. Preview & Download</h2>
              {panels.length > 0 && (
                <span className="text-muted-foreground/50 text-xs">
                  {layoutResult.sheetWidth.toFixed(1)} x {layoutResult.sheetHeight.toFixed(1)} mm
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Mode selector */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground/50">Mode:</label>
                <select
                  value={outputMode}
                  onChange={(e) => setOutputMode(e.target.value as OutputMode)}
                  className="h-9 rounded-sm border border-input bg-secondary px-2 text-xs text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="laser-cut">Laser Cut (SVG)</option>
                  <option value="3d-print">3D Print (STL)</option>
                </select>
              </div>

              {/* Material or color picker based on mode */}
              {outputMode === "laser-cut" ? (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="material" className="text-xs text-muted-foreground/50">Material:</label>
                  <select
                    id="material"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value as MaterialType)}
                    className="h-9 rounded-sm border border-input bg-secondary px-2 text-xs text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    title="Preview appearance only"
                  >
                    {Object.entries(MATERIAL_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground/50">Filament color:</label>
                  {/* Preset swatches */}
                  {["#f0f0f0", "#2a2a2a", "#808080", "#cc3333", "#3355cc", "#33aa55", "#dd7722"].map((c) => (
                    <button
                      key={c}
                      className={`w-7 h-7 rounded-sm border ${printColor === c ? "border-primary ring-2 ring-primary/50" : "border-input"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setPrintColor(c)}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={printColor}
                    onChange={(e) => setPrintColor(e.target.value)}
                    className="w-9 h-9 rounded-sm border border-input cursor-pointer"
                    title="Custom filament color"
                  />
                </div>
              )}

              {/* Download buttons */}
              {outputMode === "laser-cut" ? (
                <>
                  <span className="text-muted-foreground/40 text-xs hidden sm:inline">
                    <span className="text-[#FF6666]">red</span> = cut &middot; <span className="text-[#6666FF]">blue</span> = engrave
                  </span>
                  <Button onClick={handleDownload} disabled={panels.length === 0} className="w-full sm:w-auto">
                    Download SVG
                  </Button>
                </>
              ) : (
                <StlDownloadDialog
                  panels={layoutResult.placed}
                  disabled={panels.length === 0}
                  engraveMode="extrude"
                />
              )}
            </div>
          </div>
          {/* Preview tabs */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setPreviewTab("2d")}
              className={`px-3 py-1.5 text-xs font-mono rounded-t-sm border border-b-0 transition-colors ${
                previewTab === "2d"
                  ? "bg-card border-border text-primary"
                  : "bg-transparent border-transparent text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              2D Sheet
            </button>
            <button
              onClick={() => setPreviewTab("3d")}
              className={`px-3 py-1.5 text-xs font-mono rounded-t-sm border border-b-0 transition-colors ${
                previewTab === "3d"
                  ? "bg-card border-border text-primary"
                  : "bg-transparent border-transparent text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              3D Panel
            </button>

            {/* 3D panel navigator — shown when on 3D tab with panels */}
            {previewTab === "3d" && panels.length > 0 && (
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={clampedIndex === 0 || stlGenerating}
                  onClick={() => setPreviewPanelIndex(clampedIndex - 1)}
                >
                  &larr;
                </Button>
                <span className="text-xs text-muted-foreground min-w-[80px] text-center">
                  {stlGenerating ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    `Panel ${clampedIndex + 1} / ${layoutResult.placed.length}`
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={clampedIndex >= layoutResult.placed.length - 1 || stlGenerating}
                  onClick={() => setPreviewPanelIndex(clampedIndex + 1)}
                >
                  &rarr;
                </Button>
              </div>
            )}

            {previewTab === "3d" && (
              <span className="text-[10px] text-muted-foreground/40 ml-auto">
                Drag to rotate, scroll to zoom
              </span>
            )}
          </div>

          {/* 2D Sheet tab */}
          {previewTab === "2d" && (
            <SvgPreview
              placed={layoutResult.placed}
              sheetWidth={layoutResult.sheetWidth}
              sheetHeight={layoutResult.sheetHeight}
              material={outputMode === "laser-cut" ? material : undefined}
              printColor={outputMode === "3d-print" ? printColor : undefined}
            />
          )}

          {/* 3D Panel tab */}
          {previewTab === "3d" && (
            <>
              {panels.length === 0 && (
                <div className="min-h-[400px] flex items-center justify-center border border-dashed border-border rounded-sm">
                  <p className="text-muted-foreground text-sm">Add panels to preview in 3D</p>
                </div>
              )}
              {panels.length > 0 && stlPreviewError && (
                <div className="w-full h-[200px] rounded-sm border border-destructive/50 flex items-center justify-center bg-[#1a1917]">
                  <p className="text-destructive text-sm">{stlPreviewError}</p>
                </div>
              )}
              {panels.length > 0 && stlGenerating && !stlPreview && !stlPreviewError && (
                <div className="w-full h-[500px] rounded-sm border border-border flex items-center justify-center bg-[#1a1917]">
                  <p className="text-muted-foreground text-sm animate-pulse">Generating 3D model...</p>
                </div>
              )}
              {panels.length > 0 && stlPreview && (
                <StlViewer
                  stlData={stlPreview}
                  color={outputMode === "3d-print" ? printColor : MATERIAL_CONFIG[material]?.panelFill ?? "#c0c0c0"}
                  className="w-full h-[500px] rounded-sm border border-border overflow-hidden"
                />
              )}
            </>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-4 pb-8 flex flex-col items-center gap-3">
          <p className="text-muted-foreground/50 text-xs">
            Made by{" "}
            <a href="https://github.com/ogabrielluiz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              ogabrielluiz
            </a>
            {" "}&middot;{" "}
            <a href="https://github.com/ogabrielluiz/rackcut" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Source on GitHub
            </a>
          </p>
          <a href="https://www.buymeacoffee.com/ogabrielluiz" target="_blank" rel="noopener noreferrer">
            <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" className="h-[60px] w-[217px]" />
          </a>
        </footer>
      </main>
    </div>
  );
}

export default App;
