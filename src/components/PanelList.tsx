import { Button } from '@/components/ui/button'
import type { Format, PanelEntry, PatternType } from '@/lib/types'
import { PATTERN_LABELS } from '@/lib/patterns'

const FORMAT_LABELS: Record<Format, string> = {
  '3u': '3U',
  '1u-intellijel': '1U Intellijel',
  '1u-pulplogic': '1U Pulp Logic',
}

interface PanelListProps {
  panels: PanelEntry[]
  onUpdate: (id: string, quantity: number) => void
  onUpdatePattern: (id: string, pattern: PatternType) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export default function PanelList({
  panels,
  onUpdate,
  onUpdatePattern,
  onRemove,
  onClear,
}: PanelListProps) {
  return (
    <div className="flex flex-col gap-2">
      {panels.map((panel) => {
        const formatLabel = FORMAT_LABELS[panel.format]
        const panelLabel = `${panel.hp}HP ${formatLabel}`

        return (
          <div
            key={panel.id}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5"
          >
            <span className="text-primary font-semibold text-sm">
              {panel.hp}HP
            </span>
            <span className="text-muted-foreground text-sm">{formatLabel}</span>
            <span className="text-foreground text-sm">×{panel.quantity}</span>

            <select
              value={panel.pattern}
              onChange={(e) => onUpdatePattern(panel.id, e.target.value as PatternType)}
              className="h-7 rounded-sm border border-input bg-secondary px-2 text-xs text-muted-foreground ml-2"
              aria-label={`Pattern for ${panelLabel}`}
            >
              {Object.entries(PATTERN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Decrease quantity of ${panelLabel}`}
                onClick={() => onUpdate(panel.id, Math.max(1, panel.quantity - 1))}
              >
                −
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Increase quantity of ${panelLabel}`}
                onClick={() => onUpdate(panel.id, panel.quantity + 1)}
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${panelLabel}`}
                onClick={() => onRemove(panel.id)}
              >
                ×
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
