// Downscales the traced photo before persisting it, since browser storage has a
// size cap. Returns a scale `factor` (newDimension / originalDimension) so callers
// can keep vertex coordinates consistent with the smaller saved image.
export async function compressImageForStorage(src, w, h, maxDim = 1400, quality = 0.78) {
  if (Math.max(w, h) <= maxDim) return { src, w, h, factor: 1 };
  const factor = maxDim / Math.max(w, h);
  const newW = Math.round(w * factor);
  const newH = Math.round(h * factor);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, newW, newH);
  return { src: canvas.toDataURL("image/jpeg", quality), w: newW, h: newH, factor };
}
