import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PanelForm from "@/components/PanelForm";
import PanelList from "@/components/PanelList";
import SvgPreview from "@/components/SvgPreview";
import ModularGridDialog from "@/components/ModularGridDialog";
import { computePanel, layoutPanels, splitBlank } from "@/lib/panel";
import { PATTERN_LABELS } from "@/lib/patterns";
import { generateSvg, downloadSvg } from "@/lib/svg";
import { DEFAULT_GAP, MIN_GAP, MAX_GAP, DEFAULT_MAX_BLANK_HP } from "@/lib/constants";
import type { PanelEntry, Format, HoleStyle, SplitMode, PatternType } from "@/lib/types";

function App() {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [gap, setGap] = useState(DEFAULT_GAP);
  const [maxBlankHp, setMaxBlankHp] = useState(DEFAULT_MAX_BLANK_HP);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [globalPattern, setGlobalPattern] = useState<PatternType>("none");

  function handleAdd(panel: {
    hp: number;
    format: Format;
    holeStyle: HoleStyle;
    quantity: number;
  }) {
    // Split if exceeds max
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

  function handleUpdateQuantity(id: string, quantity: number) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity } : p))
    );
  }

  function handleRemove(id: string) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdatePattern(id: string, pattern: PatternType) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, pattern } : p))
    );
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
      return Array.from({ length: entry.quantity }, (_, i) => ({
        spec,
        pattern: entry.pattern,
        patternSeed: entry.patternSeed + i, // each copy gets a unique seed
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

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-primary text-2xl font-bold">rackcut</h1>
        <p className="text-muted-foreground text-sm">
          Eurorack blank panel SVG generator
        </p>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Controls bar */}
        <section className="flex flex-wrap items-end gap-6">
          <PanelForm onAdd={handleAdd} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-input">Gap (mm)</Label>
            <Input
              id="gap-input"
              type="number"
              value={gap}
              min={MIN_GAP}
              max={MAX_GAP}
              step={0.5}
              className="w-24"
              onChange={handleGapChange}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-blank-hp">Max blank HP</Label>
            <Input
              id="max-blank-hp"
              type="number"
              value={maxBlankHp}
              min={1}
              max={128}
              className="w-24"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 128) {
                  setMaxBlankHp(val);
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="split-mode">Split mode</Label>
            <select
              id="split-mode"
              value={splitMode}
              onChange={(e) => setSplitMode(e.target.value as SplitMode)}
              className="h-9 rounded-sm border border-input bg-secondary px-3 text-sm text-foreground"
            >
              <option value="equal">Equal</option>
              <option value="fill-max">Fill max first</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pattern">Engrave pattern</Label>
            <select
              id="pattern"
              value={globalPattern}
              onChange={(e) => {
                const newPattern = e.target.value as PatternType;
                setGlobalPattern(newPattern);
                // Apply to all existing panels
                setPanels((prev) =>
                  prev.map((p) => ({ ...p, pattern: newPattern }))
                );
              }}
              className="h-9 rounded-sm border border-input bg-secondary px-3 text-sm text-foreground"
            >
              {Object.entries(PATTERN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <ModularGridDialog onImport={handleModularGridImport} />

          <Button
            onClick={handleDownload}
            disabled={panels.length === 0}
          >
            Download SVG
          </Button>
        </section>

        {/* Panel list */}
        {panels.length > 0 && (
          <section>
            <PanelList
              panels={panels}
              onUpdate={handleUpdateQuantity}
              onUpdatePattern={handleUpdatePattern}
              onRemove={handleRemove}
              onClear={handleClear}
            />
          </section>
        )}

        {/* SVG preview */}
        <section>
          <SvgPreview
            placed={layoutResult.placed}
            sheetWidth={layoutResult.sheetWidth}
            sheetHeight={layoutResult.sheetHeight}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
