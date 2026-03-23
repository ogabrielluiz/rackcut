import { Button } from '@/components/ui/button'
import type { Format, HoleStyle, PanelEntry, PatternType } from '@/lib/types'
import { SORTED_PATTERN_ENTRIES } from '@/lib/patterns'
import { MIN_HP, MAX_HP } from '@/lib/constants'

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: '3u', label: '3U' },
  { value: '1u-intellijel', label: '1U Intellijel' },
  { value: '1u-pulplogic', label: '1U Pulp Logic' },
]

const selectBase = "rounded-sm border border-input bg-secondary text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

interface PanelListProps {
  panels: PanelEntry[]
  onUpdatePanel: (id: string, updates: Partial<PanelEntry>) => void
  onRandomizeSeed: (id: string) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export default function PanelList({
  panels,
  onUpdatePanel,
  onRandomizeSeed,
  onDuplicate,
  onRemove,
  onClear,
}: PanelListProps) {
  return (
    <div className="flex flex-col gap-2">
      {panels.map((panel) => {
        const formatLabel = FORMAT_OPTIONS.find(f => f.value === panel.format)?.label ?? panel.format;
        const panelLabel = `${panel.hp}HP ${formatLabel}`

        return (
          <div
            key={panel.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-card px-3 py-2"
          >
            {/* HP */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-muted-foreground/50" htmlFor={`hp-${panel.id}`}>HP</label>
              <input
                id={`hp-${panel.id}`}
                type="number"
                value={panel.hp}
                min={MIN_HP}
                max={MAX_HP}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= MIN_HP && val <= MAX_HP) {
                    onUpdatePanel(panel.id, { hp: val });
                  }
                }}
                className={`w-14 h-7 px-1.5 text-sm text-primary font-semibold text-center ${selectBase}`}
                aria-label={`HP for ${panelLabel}`}
              />
            </div>

            {/* Format */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-muted-foreground/50" htmlFor={`fmt-${panel.id}`}>Format</label>
              <select
                id={`fmt-${panel.id}`}
                value={panel.format}
                onChange={(e) => onUpdatePanel(panel.id, { format: e.target.value as Format })}
                className={`h-7 px-1.5 text-xs text-muted-foreground ${selectBase}`}
                aria-label={`Format for ${panelLabel}`}
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Hole style */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-muted-foreground/50" htmlFor={`holes-${panel.id}`}>Holes</label>
              <select
                id={`holes-${panel.id}`}
                value={panel.holeStyle}
                onChange={(e) => onUpdatePanel(panel.id, { holeStyle: e.target.value as HoleStyle })}
                className={`h-7 px-1.5 text-xs text-muted-foreground ${selectBase}`}
                aria-label={`Hole style for ${panelLabel}`}
              >
                <option value="slot">Slot</option>
                <option value="circle">Circle</option>
              </select>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-muted-foreground/50">Qty</label>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Decrease quantity of ${panelLabel}`}
                  onClick={() => onUpdatePanel(panel.id, { quantity: Math.max(1, panel.quantity - 1) })}
                >
                  -
                </Button>
                <span className="text-foreground text-sm w-6 text-center" aria-live="polite">{panel.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Increase quantity of ${panelLabel}`}
                  onClick={() => onUpdatePanel(panel.id, { quantity: Math.min(100, panel.quantity + 1) })}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Pattern + seed */}
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="text-[10px] text-muted-foreground/50" htmlFor={`pat-${panel.id}`}>Pattern</label>
              <select
                id={`pat-${panel.id}`}
                value={panel.pattern}
                onChange={(e) => onUpdatePanel(panel.id, { pattern: e.target.value as PatternType })}
                className={`h-7 px-1.5 text-xs text-muted-foreground ${selectBase}`}
                aria-label={`Pattern for ${panelLabel}`}
              >
                {SORTED_PATTERN_ENTRIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Randomize pattern for ${panelLabel}`}
                  onClick={() => onRandomizeSeed(panel.id)}
                  title="Randomize seed"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6"/>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                    <path d="M3 22v-6h6"/>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                  </svg>
                </Button>
                <input
                  id={`seed-${panel.id}`}
                  type="number"
                  value={panel.patternSeed}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      onUpdatePanel(panel.id, { patternSeed: val });
                    }
                  }}
                  className={`w-20 h-7 px-1.5 text-xs text-muted-foreground/60 font-mono tabular-nums text-center ${selectBase}`}
                  title="Pattern seed -- same seed + pattern = same result"
                  aria-label={`Seed for ${panelLabel}`}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Copy seed for ${panelLabel}`}
                  onClick={() => navigator.clipboard.writeText(String(panel.patternSeed))}
                  title="Copy seed"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Duplicate ${panelLabel}`}
                onClick={() => onDuplicate(panel.id)}
                title="Duplicate this panel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${panelLabel}`}
                onClick={() => onRemove(panel.id)}
                title="Remove this panel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </Button>
            </div>
          </div>
        )
      })}

      {panels.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Clear all panels"
          className="self-end text-muted-foreground"
          onClick={onClear}
        >
          Clear all
        </Button>
      )}
    </div>
  )
}
