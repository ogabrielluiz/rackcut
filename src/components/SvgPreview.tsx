import { useMemo } from "react";
import type { PlacedPanel } from "@/lib/types";
import { SVG_MARGIN, SLOT_WIDTH, SLOT_HEIGHT, HOLE_DIAMETER } from "@/lib/constants";

interface SvgPreviewProps {
  placed: PlacedPanel[];
  sheetWidth: number;
  sheetHeight: number;
}

function PreviewPanel({ pp, index }: { pp: PlacedPanel; index: number }) {
  const s = pp.spec;
  const colors = [
    { fill: "#1e1e2e", stroke: "#c8b870" },
    { fill: "#1e2e1e", stroke: "#70c878" },
    { fill: "#2e1e1e", stroke: "#c87070" },
    { fill: "#1e1e2e", stroke: "#7088c8" },
    { fill: "#2e2e1e", stroke: "#c8a870" },
    { fill: "#2e1e2e", stroke: "#b870c8" },
  ];
  const color = colors[index % colors.length];

  return (
    <g transform={`translate(${pp.x},${pp.y})`}>
      {/* Panel body */}
      <rect
        x={0}
        y={0}
        width={s.width}
        height={s.height}
        rx={0.8}
        ry={0.8}
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth={0.4}
      />

      {/* Subtle brushed-metal lines */}
      {Array.from({ length: Math.floor(s.height / 3) }, (_, i) => (
        <line
          key={`grain-${i}`}
          x1={0.5}
          y1={i * 3 + 1.5}
          x2={s.width - 0.5}
          y2={i * 3 + 1.5}
          stroke={color.stroke}
          strokeWidth={0.03}
          opacity={0.15}
        />
      ))}

      {/* Mounting holes */}
      {s.holes.map(([cx, cy], i) =>
        s.holeStyle === "circle" ? (
          <g key={`hole-${i}`}>
            <circle
              cx={cx}
              cy={cy}
              r={HOLE_DIAMETER / 2 + 0.3}
              fill="none"
              stroke={color.stroke}
              strokeWidth={0.15}
              opacity={0.3}
            />
            <circle
              cx={cx}
              cy={cy}
              r={HOLE_DIAMETER / 2}
              fill="#0a0a0a"
              stroke={color.stroke}
              strokeWidth={0.2}
            />
          </g>
        ) : (
          <g key={`hole-${i}`}>
            <rect
              x={cx - SLOT_WIDTH / 2 - 0.3}
              y={cy - SLOT_HEIGHT / 2 - 0.3}
              width={SLOT_WIDTH + 0.6}
              height={SLOT_HEIGHT + 0.6}
              rx={Math.min(SLOT_WIDTH, SLOT_HEIGHT) / 2 + 0.3}
              ry={Math.min(SLOT_WIDTH, SLOT_HEIGHT) / 2 + 0.3}
              fill="none"
              stroke={color.stroke}
              strokeWidth={0.1}
              opacity={0.3}
            />
            <rect
              x={cx - SLOT_WIDTH / 2}
              y={cy - SLOT_HEIGHT / 2}
              width={SLOT_WIDTH}
              height={SLOT_HEIGHT}
              rx={Math.min(SLOT_WIDTH, SLOT_HEIGHT) / 2}
              ry={Math.min(SLOT_WIDTH, SLOT_HEIGHT) / 2}
              fill="#0a0a0a"
              stroke={color.stroke}
              strokeWidth={0.2}
            />
          </g>
        )
      )}

      {/* Label */}
      <text
        x={s.width / 2}
        y={s.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="monospace"
        fontSize={Math.min(5, s.width * 0.12, s.height * 0.08)}
        fill={color.stroke}
        opacity={0.8}
      >
        {pp.label}
      </text>

      {/* Dimensions below label */}
      <text
        x={s.width / 2}
        y={s.height / 2 + Math.min(5, s.width * 0.12, s.height * 0.08) + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="monospace"
        fontSize={Math.min(3, s.width * 0.07, s.height * 0.05)}
        fill={color.stroke}
        opacity={0.4}
      >
        {s.width.toFixed(1)} × {s.height.toFixed(1)} mm
      </text>
    </g>
  );
}

export default function SvgPreview({
  placed,
  sheetWidth,
  sheetHeight,
}: SvgPreviewProps) {
  const margin = SVG_MARGIN;
  const vw = sheetWidth + 2 * margin;
  const vh = sheetHeight + 2 * margin;

  if (placed.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center border border-dashed border-border rounded-sm">
        <p className="text-muted-foreground text-sm">
          Add panels to preview your cut sheet
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] bg-[#0c0c0c] rounded-sm overflow-auto flex items-center justify-center p-6">
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="w-full max-w-full"
        style={{ aspectRatio: `${vw} / ${vh}` }}
      >
        {/* Sheet background */}
        <rect
          x={margin - 1}
          y={margin - 1}
          width={sheetWidth + 2}
          height={sheetHeight + 2}
          rx={1}
          ry={1}
          fill="none"
          stroke="#333"
          strokeWidth={0.15}
          strokeDasharray="2 1"
        />

        <g transform={`translate(${margin},${margin})`}>
          {placed.map((pp, i) => (
            <PreviewPanel key={i} pp={pp} index={i} />
          ))}
        </g>

        {/* Sheet dimensions label */}
        <text
          x={vw / 2}
          y={vh - 1}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={2.5}
          fill="#555"
        >
          Sheet: {sheetWidth.toFixed(1)} × {sheetHeight.toFixed(1)} mm — {placed.length} panel{placed.length !== 1 ? "s" : ""}
        </text>
      </svg>
    </div>
  );
}
