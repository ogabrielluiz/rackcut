import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_HP, MAX_HP } from "@/lib/constants";
import type { Format, HoleStyle } from "@/lib/types";

interface PanelFormProps {
  onAdd: (panel: {
    hp: number;
    format: Format;
    holeStyle: HoleStyle;
    quantity: number;
  }) => void;
}

export default function PanelForm({ onAdd }: PanelFormProps) {
  const [hp, setHp] = useState(8);
  const [format, setFormat] = useState<Format>("3u");
  const [holeStyle, setHoleStyle] = useState<HoleStyle>("slot");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!Number.isInteger(hp) || hp < MIN_HP || hp > MAX_HP) {
      setError(`HP must be an integer between ${MIN_HP} and ${MAX_HP}.`);
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setError(null);
    onAdd({ hp, format, holeStyle, quantity });
  }

  const selectClass =
    "h-10 sm:h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="panel-hp">HP</Label>
        <Input
          id="panel-hp"
          type="number"
          value={hp}
          min={MIN_HP}
          max={MAX_HP}
          className="w-20 h-10 sm:h-9"
          onChange={(e) => setHp(Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="panel-format">Format</Label>
        <select
          id="panel-format"
          value={format}
          className={selectClass}
          onChange={(e) => setFormat(e.target.value as Format)}
        >
          <option value="3u">3U</option>
          <option value="1u-intellijel">1U Intellijel</option>
          <option value="1u-pulplogic">1U Pulp Logic</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="panel-hole-style">Hole Style</Label>
        <select
          id="panel-hole-style"
          value={holeStyle}
          className={selectClass}
          onChange={(e) => setHoleStyle(e.target.value as HoleStyle)}
        >
          <option value="slot">Slot</option>
          <option value="circle">Circle</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="panel-quantity">Quantity</Label>
        <Input
          id="panel-quantity"
          type="number"
          value={quantity}
          min={1}
          className="w-20 h-10 sm:h-9"
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>

      <Button type="submit" className="h-10 sm:h-9">Add</Button>

      {error && (
        <p className="w-full text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
