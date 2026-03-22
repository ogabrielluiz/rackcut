import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PanelForm from "@/components/PanelForm";
import PanelList from "@/components/PanelList";
import SvgPreview from "@/components/SvgPreview";
import ModularGridDialog from "@/components/ModularGridDialog";
import { computePanel, layoutPanels } from "@/lib/panel";
import { generateSvg, downloadSvg } from "@/lib/svg";
import { DEFAULT_GAP, MIN_GAP, MAX_GAP } from "@/lib/constants";
import type { PanelEntry, Format, HoleStyle } from "@/lib/types";

function App() {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [gap, setGap] = useState(DEFAULT_GAP);

  function handleAdd(panel: {
    hp: number;
    format: Format;
    holeStyle: HoleStyle;
    quantity: number;
  }) {
    const entry: PanelEntry = {
      id: crypto.randomUUID(),
      ...panel,
    };
    setPanels((prev) => [...prev, entry]);
  }

  function handleUpdateQuantity(id: string, quantity: number) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity } : p))
    );
  }

  function handleRemove(id: string) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
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
      const entries = blanks.map((b) => ({
        id: crypto.randomUUID(),
        hp: b.hp,
        format: b.format,
        holeStyle: "slot" as HoleStyle,
        quantity: 1,
      }));
      setPanels((prev) => [...prev, ...entries]);
    },
    []
  );

  const layoutResult = useMemo(() => {
    const specs = panels.flatMap((entry) => {
      const spec = computePanel(entry.hp, entry.format, entry.holeStyle);
      return Array.from({ length: entry.quantity }, () => spec);
    });
    return layoutPanels(specs, gap);
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
