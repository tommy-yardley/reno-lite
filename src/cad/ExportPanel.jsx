import React, { useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { buildJpegPdf, computePrintPlan, PAPER_SIZES, PRINT_SCALES, renderPrintPdf } from "../lib/pdfExport";
import { saveOrShareFile } from "../lib/nativeExport";
import { buildCadDxf, buildCadSvg, parseProject, serializeProject } from "./export";

async function svgToCanvas(svg, multiplier = 2) {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  const viewBox = parsed.getAttribute("viewBox").split(/\s+/).map(Number);
  const width = Math.max(1, viewBox[2]);
  const height = Math.max(1, viewBox[3]);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * multiplier);
  canvas.height = Math.ceil(height * multiplier);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas;
}

export default function ExportPanel({ cad }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [paperKey, setPaperKey] = useState("a3");
  const [scaleKey, setScaleKey] = useState(cad.unit === "metric" ? "1-50" : "1/4");
  const importRef = useRef(null);
  const project = {
    nodes: cad.nodes,
    walls: cad.walls,
    rooms: cad.rooms,
    openings: cad.openings,
    objects: cad.objects,
    unit: cad.unit,
    referenceImage: cad.referenceImage,
  };
  const printScales = PRINT_SCALES[cad.unit] || PRINT_SCALES.metric;
  const selectedScale = printScales.find((scale) => scale.key === scaleKey) || printScales.find((scale) => scale.default) || printScales[0];
  const printDetails = useMemo(() => {
    if (!cad.walls.length) return null;
    const svg = new DOMParser().parseFromString(buildCadSvg(project), "image/svg+xml").documentElement;
    const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    return computePrintPlan({ realWidthIn: viewBox[2], realHeightIn: viewBox[3], paperWIn: PAPER_SIZES[paperKey].wIn, paperHIn: PAPER_SIZES[paperKey].hIn, scaleRatio: selectedScale.ratio });
  }, [cad.nodes, cad.walls, cad.rooms, cad.openings, cad.objects, paperKey, selectedScale.ratio]);

  const run = async (name, action) => {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught.message || "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const exportSvg = () => saveOrShareFile(new Blob([buildCadSvg(project)], { type: "image/svg+xml" }), "reno-lite-plan.svg");
  const exportDxf = () => saveOrShareFile(new Blob([buildCadDxf(project)], { type: "application/dxf" }), "reno-lite-plan.dxf");
  const exportProject = () => saveOrShareFile(new Blob([serializeProject(project)], { type: "application/json" }), "reno-lite-project.json");
  const exportPng = async () => {
    const canvas = await svgToCanvas(buildCadSvg(project));
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) await saveOrShareFile(blob, "reno-lite-plan.png");
  };
  const exportPdf = async () => {
    const canvas = await svgToCanvas(buildCadSvg(project), 2);
    const base64 = canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const maxPoints = 2400;
    const ratio = Math.min(1, maxPoints / Math.max(canvas.width, canvas.height));
    const blob = buildJpegPdf(bytes, canvas.width, canvas.height, canvas.width * ratio, canvas.height * ratio);
    await saveOrShareFile(blob, "reno-lite-plan.pdf");
  };
  const exportPrintPdf = async () => {
    const svg = new DOMParser().parseFromString(buildCadSvg(project), "image/svg+xml").documentElement;
    const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    const result = await renderPrintPdf({ svgEl: svg, imageW: viewBox[2], imageH: viewBox[3], scale: 1, paperKey, scaleRatio: selectedScale.ratio, scaleLabel: selectedScale.label });
    await saveOrShareFile(result.blob, `reno-lite-plan-${selectedScale.key}-${paperKey}.pdf`);
  };

  const importProject = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      cad.loadProject(parseProject(await file.text()));
      setError(null);
    } catch (caught) {
      setError(caught.message || "Could not import project");
    }
    event.target.value = "";
  };

  return (
    <section>
      <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Share and continue</h2>
      <div className="grid grid-cols-2 gap-2">
        {[{ key: "svg", label: "SVG", action: exportSvg }, { key: "dxf", label: "CAD DXF", action: exportDxf }, { key: "png", label: "PNG", action: exportPng }, { key: "pdf", label: "PDF", action: exportPdf }].map((item) => (
          <button key={item.key} disabled={busy != null || cad.walls.length === 0} onClick={() => run(item.key, item.action)} className="flex items-center justify-center gap-1.5 rounded border border-[#D8CCB0] py-1.5 text-xs text-[#5E86A8] disabled:opacity-40"><Download size={12} /> {busy === item.key ? "…" : item.label}</button>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-[#B8863E] bg-[#FBF8F1] p-3">
        <p className="mono mb-2 text-[10px] uppercase tracking-wider text-[#B8863E]">Print at true scale</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={paperKey} onChange={(event) => setPaperKey(event.target.value)} className="min-w-0 rounded border border-[#D8CCB0] bg-transparent px-1 py-1.5 text-[10px] text-[#5B6B78]">
            {Object.entries(PAPER_SIZES).map(([key, paper]) => <option key={key} value={key}>{paper.label}</option>)}
          </select>
          <select value={selectedScale.key} onChange={(event) => setScaleKey(event.target.value)} className="min-w-0 rounded border border-[#D8CCB0] bg-transparent px-1 py-1.5 text-[10px] text-[#5B6B78]">
            {printScales.map((scale) => <option key={scale.key} value={scale.key}>{scale.label}</option>)}
          </select>
        </div>
        {printDetails && <p className="mt-2 text-[10px] text-[#8A97A3]">{printDetails.tiles.length} {printDetails.tiles.length === 1 ? "sheet" : "tiled sheets"} · print at 100% / actual size</p>}
        <button disabled={busy != null || cad.walls.length === 0} onClick={() => run("print", exportPrintPdf)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-[#B8863E] py-1.5 text-xs text-[#FBF8F1] disabled:opacity-40"><Download size={12} /> {busy === "print" ? "Preparing…" : "True-scale PDF"}</button>
      </div>
      <button onClick={() => run("project", exportProject)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-[#B8863E] py-1.5 text-xs text-[#B8863E]"><Download size={12} /> Save editable project</button>
      <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={importProject} />
      <button onClick={() => importRef.current?.click()} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-[#D8CCB0] py-1.5 text-xs text-[#5E86A8]"><Upload size={12} /> Open project file</button>
      <button onClick={() => { if (window.confirm("Start a new project? The current drawing can still be restored with Undo until this page is closed.")) cad.clearProject(); }} className="mt-2 w-full rounded border border-[#B2483A] py-1.5 text-xs text-[#B2483A]">Start new project</button>
      <p className="mt-2 text-[10px] leading-4 text-[#8A97A3]">Drawing exports never include the reference image. Project files retain it so editing can continue on another device.</p>
      {error && <p className="mt-2 text-[10px] text-[#B2483A]">{error}</p>}
    </section>
  );
}
