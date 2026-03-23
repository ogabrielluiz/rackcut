import { useState, useMemo, useCallback } from "react";
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
import type { PanelEntry, Format, HoleStyle, SplitMode, PatternType, MaterialType } from "@/lib/types";
import { MATERIAL_CONFIG } from "@/components/SvgPreview";
import faviconUrl from "/favicon.svg?url";

function App() {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [gap, setGap] = useState(DEFAULT_GAP);
  const [maxBlankHp, setMaxBlankHp] = useState(DEFAULT_MAX_BLANK_HP);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [globalPattern, setGlobalPattern] = useState<PatternType>("none");
  const [material, setMaterial] = useState<MaterialType>("mdf");

  function handleAdd(panel: {
    hp: number;
    format: Format;
    holeStyle: HoleStyle;
    quantity: number;
  }) {
    const hpValues = splitBlank(panel.hp, maxBlankHp, splitMode);
    const entries: PanelEntry[] = hpValues.map((hp) => ({
      id: crypto.randomUUID(),
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
      const copy: PanelEntry = { ...source, id: crypto.randomUUID() };
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
          id: crypto.randomUUID(),
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
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 mb-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 flex-1 min-w-0">
              <h2 className="text-primary text-sm font-semibold uppercase tracking-wider whitespace-nowrap">4. Preview & Download</h2>
              {panels.length > 0 && (
                <span className="text-muted-foreground/50 text-xs whitespace-nowrap">
                  {layoutResult.sheetWidth.toFixed(1)} x {layoutResult.sheetHeight.toFixed(1)} mm
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="material" className="text-xs text-muted-foreground/50 whitespace-nowrap">Material:</label>
                <select
                  id="material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value as MaterialType)}
                  className="h-9 rounded-sm border border-input bg-secondary px-2 text-xs text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  title="Preview appearance only -- does not affect the downloaded SVG"
                >
                  {Object.entries(MATERIAL_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground/40 text-xs hidden sm:block">
                <span className="text-[#FF6666]">red</span> = cut &middot; <span className="text-[#6666FF]">blue</span> = engrave
              </span>
              <Button onClick={handleDownload} disabled={panels.length === 0}>
                Download SVG
              </Button>
            </div>
          </div>
          <SvgPreview
            placed={layoutResult.placed}
            sheetWidth={layoutResult.sheetWidth}
            sheetHeight={layoutResult.sheetHeight}
            material={material}
          />
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-4 pb-8 flex flex-col items-center gap-3">
          <a href="https://www.buymeacoffee.com/ogabrielluiz" target="_blank" rel="noopener noreferrer">
            <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" className="h-[60px] w-[217px]" />
          </a>
          <p className="text-muted-foreground/40 text-xs">rackcut is open source.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
