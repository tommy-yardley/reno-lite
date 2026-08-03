import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { parseLengthInput, INCH_PER_METER } from "../../lib/units";
import { WINDOW_COLOR, WINDOW_WIDTH_PRESETS_IN, SELECTION_COLOR } from "../../constants";

export default function WindowsPanel({ fp }) {
  const { wallSegments, mode, togglePlacingWindow, windows, selectedWindowId, setSelectedWindowId, setSelectedDoorId, pushHistory, setWindowWidth, deleteWindow, unit } = fp;

  if (wallSegments.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        04 — Windows
      </h2>
      <button
        onClick={togglePlacingWindow}
        className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium border"
        style={mode === "placingWindow" ? { background: WINDOW_COLOR, color: "#FBF8F1", borderColor: WINDOW_COLOR } : { borderColor: "#D8CCB0", color: "#5E86A8" }}
      >
        <Pencil size={14} /> {mode === "placingWindow" ? "Done placing windows" : "Place a window"}
      </button>
      {mode === "placingWindow" && (
        <p className="text-[11px] mt-2" style={{ color: "#8A97A3" }}>
          Click along a wall to drop a window there. Drag it afterward to slide it; it can't cross a corner.
        </p>
      )}

      {windows.length > 0 && (
        <div className="space-y-2 mt-3">
          {windows.map((w) => (
            <div
              key={w.id}
              onClick={() => {
                setSelectedWindowId(w.id);
                setSelectedDoorId(null);
              }}
              className="rounded-md border p-2 flex flex-col gap-1.5 cursor-pointer"
              style={{ borderColor: selectedWindowId === w.id ? SELECTION_COLOR : "#D8CCB0" }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: WINDOW_COLOR }} />
                <span className="text-xs" style={{ color: "#5E86A8" }}>Width</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={unit === "imperial" ? (w.widthInches / 12).toFixed(2) : (w.widthInches / INCH_PER_METER).toFixed(2)}
                  onFocus={pushHistory}
                  onChange={(e) => setWindowWidth(w.id, parseLengthInput(e.target.value, unit) ?? w.widthInches)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-xs mono"
                />
                <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "ft" : "m"}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWindow(w.id);
                    if (selectedWindowId === w.id) setSelectedWindowId(null);
                  }}
                  style={{ color: "#B2483A", marginLeft: "auto" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {selectedWindowId === w.id && (
                <div className="flex flex-wrap gap-1">
                  {WINDOW_WIDTH_PRESETS_IN.map((presetIn) => (
                    <button
                      key={presetIn}
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistory();
                        setWindowWidth(w.id, presetIn);
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] border"
                      style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}
                    >
                      {unit === "imperial" ? `${presetIn}"` : `${Math.round(presetIn * 2.54)}cm`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
