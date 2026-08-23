import React from "react";
import { Pencil } from "lucide-react";

const VOID_BORDER = "#5F5347";

export default function TracePanel({ fp }) {
  const { scale, angleSnap, setAngleSnap, mode, startDrawingRoom } = fp;

  if (!scale) return null;
  // Active tracing/naming has its own UI right next to the canvas (see
  // ModeStatusBar) — this panel just offers the entry points.
  if (mode === "drawing" || mode === "naming") return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        03 — Trace rooms &amp; blocked space
      </h2>
      <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer" style={{ color: "#5E86A8" }}>
        <input type="checkbox" checked={angleSnap} onChange={(e) => setAngleSnap(e.target.checked)} className="accent-[#B8863E]" />
        Snap to 15° angles while tracing and dragging corners
      </label>
      <div className="flex flex-col gap-2">
        <button onClick={() => startDrawingRoom("room")} className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium" style={{ background: "#B8863E", color: "#FBF8F1" }}>
          <Pencil size={14} /> Trace a room
        </button>
        <button onClick={() => startDrawingRoom("void")} className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium border" style={{ borderColor: VOID_BORDER, color: "#7A6F5C" }}>
          <Pencil size={14} /> Trace a blocked-in space
        </button>
        <p className="text-[11px]" style={{ color: "#8A97A3" }}>
          Use blocked-in space for a chimney breast, column, or any pocket behind a wall that pokes out — it's hatched out and subtracted from the room it sits in.
        </p>
      </div>
    </section>
  );
}
