// Two different kinds of PDF export live here:
//  - buildJpegPdf: a single-page snapshot (what "Export > PDF" always did) — good
//    for sharing, not sized to any particular scale on paper.
//  - buildMultiPageJpegPdf + computePrintPlan + renderPrintPdf: genuine 1:1-scale
//    printing. A real floor plan is almost always bigger than one sheet of paper at
//    a real architectural scale, so this tiles the plan across as many pages as it
//    takes (like poster-printing software does), with a small overlap margin and a
//    sheet reference label (A1, A2, B1...) on each page so they can be trimmed and
//    taped together afterward.
//
// No external PDF library is used — this hand-writes a minimal valid PDF (a
// Catalog → Pages → N page objects, each with one DCTDecode/JPEG image XObject and
// a content stream that places it). The byte-offset bookkeeping for the xref table
// is the fragile part of doing this by hand, and was verified against known-good
// offsets in isolation before being wired in here.

export const PAPER_SIZES = {
  letter: { label: "Letter (8.5 × 11 in)", wIn: 8.5, hIn: 11 },
  legal: { label: "Legal (8.5 × 14 in)", wIn: 8.5, hIn: 14 },
  tabloid: { label: "Tabloid (11 × 17 in)", wIn: 11, hIn: 17 },
  a4: { label: "A4 (210 × 297 mm)", wIn: 8.27, hIn: 11.69 },
  a3: { label: "A3 (297 × 420 mm)", wIn: 11.69, hIn: 16.54 },
  archD: { label: "ARCH D (24 × 36 in)", wIn: 24, hIn: 36 },
  archE: { label: "ARCH E (36 × 48 in)", wIn: 36, hIn: 48 },
};

// `ratio` = how many real inches equal one printed inch. Dimensionless, so the
// same numbers work whether you think of the drawing in feet or meters.
export const PRINT_SCALES = {
  imperial: [
    { key: "1/8", label: '1/8" = 1\'-0"', ratio: 96 },
    { key: "3/16", label: '3/16" = 1\'-0"', ratio: 64 },
    { key: "1/4", label: '1/4" = 1\'-0"', ratio: 48, default: true },
    { key: "3/8", label: '3/8" = 1\'-0"', ratio: 32 },
    { key: "1/2", label: '1/2" = 1\'-0"', ratio: 24 },
  ],
  metric: [
    { key: "1-100", label: "1 : 100", ratio: 100 },
    { key: "1-50", label: "1 : 50", ratio: 50, default: true },
    { key: "1-20", label: "1 : 20", ratio: 20 },
    { key: "1-10", label: "1 : 10", ratio: 10 },
  ],
};

function buildMultiPageJpegPdf(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = {};
  const pushStr = (s) => {
    const b = enc.encode(s);
    chunks.push(b);
    offset += b.length;
  };
  const pushBytes = (b) => {
    chunks.push(b);
    offset += b.length;
  };

  const n = pages.length;
  const pageObjNums = Array.from({ length: n }, (_, i) => 3 + 3 * i);

  pushStr("%PDF-1.4\n");
  offsets[1] = offset;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = offset;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((x) => `${x} 0 R`).join(" ")}] /Count ${n} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const pageObj = 3 + 3 * i;
    const imgObj = pageObj + 1;
    const contentObj = pageObj + 2;

    offsets[pageObj] = offset;
    pushStr(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /MediaBox [0 0 ${page.ptW.toFixed(2)} ${page.ptH.toFixed(2)}] /Contents ${contentObj} 0 R >>\nendobj\n`
    );

    offsets[imgObj] = offset;
    pushStr(
      `${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.pxW} /Height ${page.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(page.jpegBytes);
    pushStr("\nendstream\nendobj\n");

    offsets[contentObj] = offset;
    const contentStream = `q ${page.ptW.toFixed(2)} 0 0 ${page.ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
    const contentBytes = enc.encode(contentStream);
    pushStr(`${contentObj} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr("\nendstream\nendobj\n");
  });

  const xrefStart = offset;
  const totalObjs = 2 + 3 * n;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pushStr(xref);
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

export function buildJpegPdf(jpegBytes, pxWidth, pxHeight, ptWidth, ptHeight) {
  return buildMultiPageJpegPdf([{ jpegBytes, pxW: pxWidth, pxH: pxHeight, ptW: ptWidth, ptH: ptHeight }]);
}

// Works out how many sheets a plan needs at a given paper size + scale, and where
// each sheet's content starts/ends (in *printed* inches, i.e. already divided by
// the scale ratio) so it can be cropped out of a single rasterized source image.
export function computePrintPlan({ realWidthIn, realHeightIn, paperWIn, paperHIn, scaleRatio, marginIn = 0.5, overlapIn = 0.5 }) {
  const printableWIn = paperWIn - marginIn * 2;
  const printableHIn = paperHIn - marginIn * 2;
  const printedWidthIn = realWidthIn / scaleRatio;
  const printedHeightIn = realHeightIn / scaleRatio;

  const stepW = Math.max(printableWIn - overlapIn, 1);
  const stepH = Math.max(printableHIn - overlapIn, 1);

  const cols = printedWidthIn <= printableWIn ? 1 : Math.ceil((printedWidthIn - printableWIn) / stepW) + 1;
  const rows = printedHeightIn <= printableHIn ? 1 : Math.ceil((printedHeightIn - printableHIn) / stepH) + 1;

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startXIn = Math.min(c * stepW, Math.max(0, printedWidthIn - printableWIn));
      const startYIn = Math.min(r * stepH, Math.max(0, printedHeightIn - printableHIn));
      const tileWIn = Math.min(printableWIn, printedWidthIn - startXIn);
      const tileHIn = Math.min(printableHIn, printedHeightIn - startYIn);
      tiles.push({ row: r, col: c, label: `${String.fromCharCode(65 + r)}${c + 1}`, startXIn, startYIn, tileWIn, tileHIn });
    }
  }

  return {
    cols,
    rows,
    printedWidthIn,
    printedHeightIn,
    printableWIn,
    printableHIn,
    marginIn,
    overlapIn,
    tiles,
    singlePage: cols === 1 && rows === 1,
  };
}

async function rasterizeSvgToCanvas(svgEl, pxW, pxH, sourceW, sourceH) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", sourceW);
  clone.setAttribute("height", sourceH);
  const svgString = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FBF8F1";
  ctx.fillRect(0, 0, pxW, pxH);
  ctx.drawImage(img, 0, 0, pxW, pxH);
  URL.revokeObjectURL(url);
  return canvas;
}

// The main entry point: given the live SVG element and the plan's real-world size,
// produces a ready-to-download multi-page PDF Blob, tiled and labeled for reassembly.
export async function renderPrintPdf({ svgEl, imageW, imageH, scale, paperKey, scaleRatio, scaleLabel, targetDpi = 150 }) {
  const paper = PAPER_SIZES[paperKey];
  if (!paper) throw new Error(`Unknown paper size: ${paperKey}`);

  const realWidthIn = imageW * scale;
  const realHeightIn = imageH * scale;
  const plan = computePrintPlan({ realWidthIn, realHeightIn, paperWIn: paper.wIn, paperHIn: paper.hIn, scaleRatio });

  // Keep every rasterized canvas under safe browser limits regardless of paper size or DPI requested.
  const maxTileDimPx = 4096;
  const maxSourceDimPx = 8000;
  const dpiCapTile = maxTileDimPx / Math.max(paper.wIn, paper.hIn);
  const dpiCapSource = maxSourceDimPx / Math.max(plan.printedWidthIn, plan.printedHeightIn);
  // Never exceed the safety caps, even if that means going below a "nice" DPI —
  // an unusually large plan getting a lower-quality print is fine; a crashed
  // export from an oversized canvas is not. (A `Math.max(72, ...)` floor here
  // would silently defeat these caps for exactly the large plans they exist for.)
  const effectiveDpi = Math.min(targetDpi, dpiCapTile, dpiCapSource);

  const sourceWpx = Math.round(plan.printedWidthIn * effectiveDpi);
  const sourceHpx = Math.round(plan.printedHeightIn * effectiveDpi);
  const sourceCanvas = await rasterizeSvgToCanvas(svgEl, sourceWpx, sourceHpx, imageW, imageH);

  const pageWpx = Math.round(paper.wIn * effectiveDpi);
  const pageHpx = Math.round(paper.hIn * effectiveDpi);
  const marginPx = Math.round(plan.marginIn * effectiveDpi);

  const pages = plan.tiles.map((tile) => {
    const destCanvas = document.createElement("canvas");
    destCanvas.width = pageWpx;
    destCanvas.height = pageHpx;
    const ctx = destCanvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, pageWpx, pageHpx);

    const srcX = Math.round(tile.startXIn * effectiveDpi);
    const srcY = Math.round(tile.startYIn * effectiveDpi);
    const srcW = Math.round(tile.tileWIn * effectiveDpi);
    const srcH = Math.round(tile.tileHIn * effectiveDpi);
    ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, marginPx, marginPx, srcW, srcH);

    ctx.fillStyle = "#000000";
    const fontPx = Math.max(10, Math.round(effectiveDpi * 0.12));
    ctx.font = `${fontPx}px sans-serif`;
    ctx.fillText(
      `Sheet ${tile.label} of ${plan.tiles.length} — scale ${scaleLabel} — trim ${plan.overlapIn}in overlap before joining`,
      marginPx,
      Math.max(fontPx, marginPx - 6)
    );

    const jpegDataUrl = destCanvas.toDataURL("image/jpeg", 0.92);
    const base64 = jpegDataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return { jpegBytes: bytes, pxW: pageWpx, pxH: pageHpx, ptW: paper.wIn * 72, ptH: paper.hIn * 72 };
  });

  return { blob: buildMultiPageJpegPdf(pages), plan, effectiveDpi };
}
