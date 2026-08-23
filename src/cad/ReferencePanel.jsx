import React, { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

export default function ReferencePanel({ cad }) {
  const [zoom, setZoom] = useState(100);
  const { referenceImage, fileInputRef, handleReferenceUpload, setReferenceImage } = cad;
  return (
    <aside className="rounded-xl border border-[#D8CCB0] bg-[#F3EEE3] p-3 shadow-sm lg:h-[calc(100vh-170px)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="serif text-sm font-semibold text-[#1B2B3A]">Reference plan</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-[#5B6B78]">Visual reference only. It never sets scale or appears in exports.</p>
        </div>
        {referenceImage && (
          <button onClick={() => setReferenceImage(null)} className="rounded border border-[#D8CCB0] p-1.5 text-[#7A3F38]" title="Remove reference">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
      {!cad.layerSettings.reference.visible && <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-[#D8CCB0] text-center text-xs text-[#8A97A3]">Reference layer hidden</div>}
      {cad.layerSettings.reference.visible && (
      <>
      {referenceImage ? (
        <div className="flex h-[calc(100%-64px)] min-h-[260px] flex-col">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#D8CCB0] bg-white p-2">
            <img src={referenceImage.src} alt="Uploaded floor plan reference" className="m-auto block h-auto object-contain" style={{ width: `${zoom}%`, maxWidth: "none" }} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-[10px] text-[#5B6B78]">Reference zoom<input type="range" min="50" max="300" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1 accent-[#B8863E]" /><span className="mono w-9 text-right">{zoom}%</span></label>
          <button onClick={() => fileInputRef.current?.click()} className="mt-2 w-full rounded border border-[#D8CCB0] py-1.5 text-xs text-[#5E86A8]">
            Replace reference
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[260px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#D8CCB0] bg-[#FBF8F1] text-[#5E86A8]"
        >
          <ImagePlus size={22} />
          <span className="text-xs font-medium">Add agent floor plan</span>
          <span className="max-w-[190px] text-[10px] text-[#8A97A3]">Keep it beside the measured drawing for comparison.</span>
        </button>
      )}
      </>
      )}
    </aside>
  );
}
