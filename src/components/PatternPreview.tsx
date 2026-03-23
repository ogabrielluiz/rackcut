import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { generatePattern, SORTED_PATTERN_ENTRIES } from "@/lib/patterns";
import type { PatternType } from "@/lib/types";
import { ENGRAVE_COLOR } from "@/lib/constants";

const PREVIEW_WIDTH = 101.3; // ~20HP panel
const PREVIEW_HEIGHT = 128.5; // 3U

export default function PatternPreview() {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState(42);

  const patterns = useMemo(() => {
    return SORTED_PATTERN_ENTRIES
      .filter(([key]) => key !== "none")
      .map(([key, label]) => ({
        key: key as PatternType,
        label,
        svg: generatePattern(key as PatternType, PREVIEW_WIDTH, PREVIEW_HEIGHT, seed),
      }));
  }, [seed]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Browse patterns
      </Button>
    );
  }

  return (
    <div className="border border-border rounded-sm bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-primary font-semibold text-sm">Pattern Gallery — 20HP 3U Preview</h3>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
          >
            Randomize seeds
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {patterns.map(({ key, label, svg }) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="bg-[#0c0c0c] rounded-sm p-2 aspect-[101.3/128.5] flex items-center justify-center">
              <svg
                viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
                className="w-full h-full"
              >
                {/* Panel outline */}
                <rect
                  x={0}
                  y={0}
                  width={PREVIEW_WIDTH}
                  height={PREVIEW_HEIGHT}
                  rx={0.5}
                  ry={0.5}
                  fill="#1a1a2a"
                  stroke="#444"
                  strokeWidth={0.3}
                />
                {/* Pattern */}
                <g
                  opacity={0.8}
                  dangerouslySetInnerHTML={{
                    __html: svg.replace(
                      new RegExp(`stroke="${ENGRAVE_COLOR}"`, "g"),
                      'stroke="#c8b870"'
                    ),
                  }}
                />
              </svg>
            </div>
            <span className="text-xs text-muted-foreground text-center">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
