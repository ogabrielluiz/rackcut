import type { PlacedPanel, MaterialType } from "@/lib/types";
import { SVG_MARGIN, SLOT_WIDTH, SLOT_HEIGHT, HOLE_DIAMETER } from "@/lib/constants";
import { generatePattern } from "@/lib/patterns";

export const MATERIAL_CONFIG: Record<MaterialType, {
  label: string;
  panelFill: string;
  engraveColor: string;
  holeColor: string;
  labelColor: string;
  dimColor: string;
  bgColor: string;
  grainLines?: { color: string; opacity: number; spacing: number; angle?: number };
}> = {
  "mdf": {
    label: "MDF",
    panelFill: "#b5875a",
    engraveColor: "#3d2510",
    holeColor: "#2a1a0c",
    labelColor: "#e8d4b8",
    dimColor: "#8a6840",
    bgColor: "#1a1008",
    grainLines: { color: "#9a7548", opacity: 0.3, spacing: 1.5 },
  },
  "birch-plywood": {
    label: "Birch Plywood",
    panelFill: "#d4bc8e",
    engraveColor: "#5a3e1a",
    holeColor: "#3a2a10",
    labelColor: "#f0e4d0",
    dimColor: "#a08050",
    bgColor: "#1a1408",
    grainLines: { color: "#c4a870", opacity: 0.25, spacing: 2.0 },
  },
  "walnut": {
    label: "Walnut",
    panelFill: "#5c3a20",
    engraveColor: "#1a0c04",
    holeColor: "#0f0802",
    labelColor: "#c8a878",
    dimColor: "#8a6840",
    bgColor: "#0a0604",
    grainLines: { color: "#4a2e18", opacity: 0.4, spacing: 1.2 },
  },
  "black-acrylic": {
    label: "Black Acrylic",
    panelFill: "#1a1a1a",
    engraveColor: "#e0e0e0",
    holeColor: "#000000",
    labelColor: "#888888",
    dimColor: "#555555",
    bgColor: "#000000",
  },
  "aluminum": {
    label: "Brushed Aluminum",
    panelFill: "#c0c0c0",
    engraveColor: "#333333",
    holeColor: "#222222",
    labelColor: "#666666",
    dimColor: "#999999",
    bgColor: "#0a0a0a",
    grainLines: { color: "#b0b0b0", opacity: 0.2, spacing: 0.8, angle: 0 },
  },
  "laser-svg": {
    label: "Laser SVG (red/blue)",
    panelFill: "#f5f3ee",
    engraveColor: "#0000FF",
    holeColor: "#ffffff",
    labelColor: "#444444",
    dimColor: "#888888",
    bgColor: "#e8e6e0",
  },
};

interface SvgPreviewProps {
  placed: PlacedPanel[];
  sheetWidth: number;
  sheetHeight: number;
  material?: MaterialType;
  printColor?: string;
}

/** Generate a material config from a filament color */
function printColorToMaterial(color: string): typeof MATERIAL_CONFIG[MaterialType] {
  // Lighten the color for the pattern highlight
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const highlight = `#${Math.min(255, r + 30).toString(16).padStart(2, "0")}${Math.min(255, g + 30).toString(16).padStart(2, "0")}${Math.min(255, b + 30).toString(16).padStart(2, "0")}`;
  const isDark = (r + g + b) / 3 < 128;

  return {
    label: "3D Print",
    panelFill: color,
    engraveColor: highlight,
    holeColor: isDark ? "#000000" : "#333333",
    labelColor: isDark ? "#ffffff" : "#333333",
    dimColor: isDark ? "#aaaaaa" : "#666666",
    bgColor: isDark ? "#000000" : "#1a1a1a",
  };
}

function PreviewPanel({ pp, index, mat }: { pp: PlacedPanel; index: number; mat: typeof MATERIAL_CONFIG[MaterialType] }) {
  const s = pp.spec;
  const clipId = `panel-clip-${index}`;
  const isLaserView = mat.label === "Laser SVG (red/blue)";
  const outlineColor = isLaserView ? "#FF0000" : mat.labelColor;

  return (
    <g transform={`translate(${pp.x},${pp.y})`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={s.width} height={s.height} rx={0.8} ry={0.8} />
        </clipPath>
      </defs>

      {/* Panel body */}
      <rect
        x={0}
        y={0}
        width={s.width}
        height={s.height}
        rx={0.8}
        ry={0.8}
        fill={mat.panelFill}
        stroke={outlineColor}
        strokeWidth={isLaserView ? 0.4 : 0.3}
        strokeOpacity={isLaserView ? 1 : 0.4}
      />

      {/* Material grain texture */}
      {mat.grainLines && (
        <g clipPath={`url(#${clipId})`} opacity={mat.grainLines.opacity}>
          {Array.from(
            { length: Math.ceil((mat.grainLines.angle !== undefined ? s.width : s.height) / mat.grainLines.spacing) + 1 },
            (_, i) => {
              const offset = i * mat.grainLines!.spacing;
              if (mat.grainLines!.angle !== undefined) {
                // Horizontal grain (aluminum)
                return (
                  <line
                    key={`grain-${i}`}
                    x1={0}
                    y1={offset}
                    x2={s.width}
                    y2={offset}
                    stroke={mat.grainLines!.color}
                    strokeWidth={0.08}
                  />
                );
              }
              // Vertical grain (wood)
              return (
                <line
                  key={`grain-${i}`}
                  x1={offset + Math.sin(i * 0.7) * 0.5}
                  y1={0}
                  x2={offset + Math.sin(i * 0.7 + 3) * 0.5}
                  y2={s.height}
                  stroke={mat.grainLines!.color}
                  strokeWidth={0.1}
                />
              );
            }
          )}
        </g>
      )}

      {/* Engrave pattern — clipped to panel */}
      {pp.pattern !== "none" && (
        <g
          opacity={0.8}
          clipPath={`url(#${clipId})`}
          dangerouslySetInnerHTML={{
            __html: generatePattern(pp.pattern, s.width, s.height, pp.patternSeed)
              .replace(/stroke="#0000FF"/g, `stroke="${mat.engraveColor}"`)
          }}
        />
      )}

      {/* Mounting holes */}
      {s.holes.map(([cx, cy], i) => {
        const holeStroke = isLaserView ? "#FF0000" : mat.labelColor;
        const holeFill = isLaserView ? "none" : mat.holeColor;
        const holeOpacity = isLaserView ? 1 : 0.3;
        return s.holeStyle === "circle" ? (
          <g key={`hole-${i}`}>
            {!isLaserView && <circle cx={cx} cy={cy} r={HOLE_DIAMETER / 2 + 0.3}
              fill="none" stroke={mat.labelColor} strokeWidth={0.1} opacity={0.2} />}
            <circle cx={cx} cy={cy} r={HOLE_DIAMETER / 2}
              fill={holeFill} stroke={holeStroke} strokeWidth={isLaserView ? 0.3 : 0.15} strokeOpacity={holeOpacity} />
          </g>
        ) : (
          <g key={`hole-${i}`}>
            <rect
              x={cx - SLOT_WIDTH / 2} y={cy - SLOT_HEIGHT / 2}
              width={SLOT_WIDTH} height={SLOT_HEIGHT}
              rx={Math.min(SLOT_WIDTH, SLOT_HEIGHT) / 2}
              ry={Math.min(SLOT_WIDTH, SLOT_HEIGHT) / 2}
              fill={holeFill} stroke={holeStroke} strokeWidth={isLaserView ? 0.3 : 0.15} strokeOpacity={holeOpacity}
            />
          </g>
        );
      })}

      {/* Label — above the panel */}
      <text
        x={s.width / 2} y={-2}
        textAnchor="middle" dominantBaseline="auto"
        fontFamily="monospace"
        fontSize={Math.min(3.5, s.width * 0.1)}
        fill={mat.labelColor} opacity={0.7}
      >
        {pp.label}
      </text>
    </g>
  );
}

export default function SvgPreview({
  placed,
  sheetWidth,
  sheetHeight,
  material,
  printColor,
}: SvgPreviewProps) {
  const margin = SVG_MARGIN;
  const vw = sheetWidth + 2 * margin;
  const vh = sheetHeight + 2 * margin;
  const mat = printColor ? printColorToMaterial(printColor) : MATERIAL_CONFIG[material ?? "mdf"];

  if (placed.length === 0) {
    return (
      <div className="min-h-[300px] sm:min-h-[400px] flex items-center justify-center border border-dashed border-border rounded-sm">
        <p className="text-muted-foreground text-sm">
          Add panels to preview your cut sheet
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[300px] sm:min-h-[400px] rounded-sm overflow-auto flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: mat.bgColor }}
    >
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="max-w-full"
        style={{
          aspectRatio: `${vw} / ${vh}`,
          maxHeight: "80vh",
          width: "auto",
        }}
      >
        {/* Sheet outline */}
        <rect
          x={margin - 1} y={margin - 1}
          width={sheetWidth + 2} height={sheetHeight + 2}
          rx={1} ry={1}
          fill="none" stroke="#444" strokeWidth={0.15} strokeDasharray="2 1"
        />

        <g transform={`translate(${margin},${margin})`}>
          {placed.map((pp, i) => (
            <PreviewPanel key={i} pp={pp} index={i} mat={mat} />
          ))}
        </g>

        {/* Sheet dimensions */}
        <text
          x={vw / 2} y={vh - 1}
          textAnchor="middle" fontFamily="monospace" fontSize={2.5} fill="#555"
        >
          Sheet: {sheetWidth.toFixed(1)} x {sheetHeight.toFixed(1)} mm — {placed.length} panel{placed.length !== 1 ? "s" : ""}
        </text>
      </svg>
    </div>
  );
}
