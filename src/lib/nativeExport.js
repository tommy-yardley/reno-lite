// Exporting a file needs to behave differently depending on where the app is running:
//  - In a normal browser, a Blob-URL + invisible <a download> click works fine.
//  - Inside a Capacitor native shell, that doesn't land anywhere the user can find —
//    it needs to be written to disk and handed to the native share sheet instead.
//
// saveOrShareFile() picks the right behavior at runtime, so the rest of the app
// (the PNG/SVG/PDF/DXF export buttons) doesn't need to know or care which
// environment it's running in.

import { Capacitor } from "@capacitor/core";

function downloadInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveOrShareFile(blob, filename) {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(blob, filename);
    return;
  }
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const base64 = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, url: written.uri });
  } catch (err) {
    // Native share failed (or the plugins aren't installed on this platform yet) —
    // fall back so the export at least does *something* rather than silently failing.
    console.error("Native share failed, falling back to browser download:", err);
    downloadInBrowser(blob, filename);
  }
}
