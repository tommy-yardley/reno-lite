import React, { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { PAPER_SIZES, computePrintPlan } from "../../lib/pdfExport";

export default function ExportPanel({ fp }) {
  const { image, exporting, exportPNG, exportSVG, exportPDF, exportDXF, scale, unit, printSettings, setPrintSettings, printScaleOptions, activeScale, printPreview, exportPrintPDF, clearSavedPlan } = fp;

  const plan = useMemo(() => {
    if (!printPreview) return null;
    return computePrintPlan({
      realWidthIn: printPreview.realWidthIn,
      realHeightIn: printPreview.realHeightIn,
      paperWIn: printPreview.paper.wIn,
      paperHIn: printPreview.paper.hIn,
      scaleRatio: activeScale.ratio,
    });
  }, [printPreview, activeScale]);

  if (!image) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        07 — Export
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={exportPNG} disabled={exporting === "png"} className="flex items-center justify-center gap-1.5 rounded border py-1.5 text-xs disabled:opacity-50" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
          <Download size={13} /> PNG
        </button>
        <button onClick={exportSVG} className="flex items-center justify-center gap-1.5 rounded border py-1.5 text-xs" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
          <Download size={13} /> SVG
        </button>
        <button onClick={exportPDF} disabled={exporting === "pdf"} className="flex items-center justify-center gap-1.5 rounded border py-1.5 text-xs disabled:opacity-50" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
          <Download size={13} /> {exporting === "pdf" ? "..." : "PDF"}
        </button>
        <button onClick={exportDXF} disabled={!scale} className="flex items-center justify-center gap-1.5 rounded border py-1.5 text-xs disabled:opacity-50" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
          <Download size={13} /> DXF
        </button>
      </div>
      <p className="text-[11px] mt-2" style={{ color: "#8A97A3" }}>
        PNG/SVG/PDF above are snapshots for sharing (not sized 1:1 on paper). DXF exports real wall/door/window/furniture vector geometry, for reopening in CAD software.
      </p>

      {scale && (
        <div className="rounded-md border p-2.5 mt-3 space-y-2" style={{ borderColor: "#D8CCB0" }}>
          <p className="text-[11px] font-medium" style={{ color: "#5B6B78" }}>Print to true scale</p>
          <div className="flex gap-2">
            <select
              value={printSettings.paperKey}
              onChange={(e) => setPrintSettings((s) => ({ ...s, paperKey: e.target.value }))}
              className="flex-1 rounded bg-[#FBF8F1] border border-[#D8CCB0] px-2 py-1 text-xs"
            >
              {Object.entries(PAPER_SIZES).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
            <select
              value={activeScale.key}
              onChange={(e) => setPrintSettings((s) => ({ ...s, scaleKey: e.target.value }))}
              className="flex-1 rounded bg-[#FBF8F1] border border-[#D8CCB0] px-2 py-1 text-xs"
            >
              {printScaleOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          {plan && (
            <p className="text-[11px]" style={{ color: "#8A97A3" }}>
              {plan.singlePage
                ? "Fits on one sheet at this scale."
                : `Needs ${plan.tiles.length} sheets (${plan.cols}×${plan.rows}) — trim and tape together using the printed overlap guide.`}
            </p>
          )}
          <button
            onClick={exportPrintPDF}
            disabled={exporting === "print"}
            className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "#B8863E", color: "#FBF8F1" }}
          >
            <Printer size={15} /> {exporting === "print" ? "Rendering…" : "Export print-ready PDF"}
          </button>
          <p className="text-[10px]" style={{ color: "#8A97A3" }}>
            Print at 100%/"actual size" — not "fit to page" — or the scale won't be accurate.
          </p>
        </div>
      )}

      <button
        onClick={() => {
          if (confirm("Delete the saved plan from this device? This can't be undone.")) clearSavedPlan();
        }}
        className="w-full mt-3 rounded border py-1.5 text-xs"
        style={{ borderColor: "#7A3F38", color: "#B2483A" }}
      >
        Clear saved plan
      </button>
    </section>
  );
}
