import { useMemo } from "react";
import type { PlacedPanel } from "@/lib/types";
import { generateSvg } from "@/lib/svg";

interface SvgPreviewProps {
  placed: PlacedPanel[];
  sheetWidth: number;
  sheetHeight: number;
}

export default function SvgPreview({
  placed,
  sheetWidth,
  sheetHeight,
}: SvgPreviewProps) {
  const svgContent = useMemo(() => {
    if (placed.length === 0) return null;
    const raw = generateSvg(placed, sheetWidth, sheetHeight);
    // Strip the <?xml ...?> processing instruction so we can embed inline
    return raw.replace(/<\?xml[^?]*\?>\n?/, "");
  }, [placed, sheetWidth, sheetHeight]);

  if (!svgContent) {
    return (
      <div className="min-h-[400px] flex items-center justify-center border border-dashed border-zinc-600 rounded-lg">
        <p className="text-zinc-400 text-sm">
          Add panels to preview your cut sheet
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] bg-[#0a0a08] rounded-lg overflow-auto flex items-center justify-center p-4">
      <div dangerouslySetInnerHTML={{ __html: svgContent }} />
    </div>
  );
}
