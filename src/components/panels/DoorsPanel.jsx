import React from "react";
import { Pencil, Trash2, FlipHorizontal2, RotateCw } from "lucide-react";
import { parseLengthInput, INCH_PER_METER } from "../../lib/units";
import { DOOR_COLOR, DOOR_WIDTH_PRESETS_IN, SELECTION_COLOR } from "../../constants";

export default function DoorsPanel({ fp }) {
  const {
    wallSegments,
    mode,
    togglePlacingDoor,
    doors,
    selectedDoorId,
    setSelectedDoorId,
    setSelectedWindowId,
    setSelectedWallKey,
    setSelectedVertexId,
    pushHistory,
    setDoorWidth,
    deleteDoor,
    flipDoorHinge,
    mirrorDoorSwing,
    unit,
  } = fp;

  if (wallSegments.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        05 — Doors
      </h2>
      <button
        onClick={togglePlacingDoor}
        className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium border"
        style={mode === "placingDoor" ? { background: DOOR_COLOR, color: "#FBF8F1", borderColor: DOOR_COLOR } : { borderColor: "#D8CCB0", color: "#5E86A8" }}
      >
        <Pencil size={14} /> {mode === "placingDoor" ? "Done placing doors" : "Place a door"}
      </button>
      {mode === "placingDoor" && (
        <p className="text-[11px] mt-2" style={{ color: "#8A97A3" }}>
          Click along a wall to drop a door. Tap an existing one instead of clicking right on top of it to select it.
        </p>
      )}

      {doors.length > 0 && (
        <div className="space-y-2 mt-3">
          {doors.map((d) => (
            <div
              key={d.id}
              onClick={() => {
                setSelectedDoorId(d.id);
                setSelectedWindowId(null);
                setSelectedWallKey(null);
                setSelectedVertexId(null);
              }}
              className="rounded-md border p-2 flex flex-col gap-1.5 cursor-pointer"
              style={{ borderColor: selectedDoorId === d.id ? SELECTION_COLOR : "#D8CCB0" }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DOOR_COLOR }} />
                <span className="text-xs" style={{ color: "#5E86A8" }}>Width</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={unit === "imperial" ? (d.widthInches / 12).toFixed(2) : (d.widthInches / INCH_PER_METER).toFixed(2)}
                  onFocus={pushHistory}
                  onChange={(e) => setDoorWidth(d.id, parseLengthInput(e.target.value, unit) ?? d.widthInches)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-xs mono"
                />
                <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "ft" : "m"}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDoor(d.id);
                    if (selectedDoorId === d.id) setSelectedDoorId(null);
                  }}
                  style={{ color: "#B2483A", marginLeft: "auto" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    flipDoorHinge(d.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded border py-1 text-[11px]"
                  style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}
                >
                  <FlipHorizontal2 size={12} /> Flip hinge
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    mirrorDoorSwing(d.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 rounded border py-1 text-[11px]"
                  style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}
                >
                  <RotateCw size={12} /> Mirror swing
                </button>
              </div>
              {selectedDoorId === d.id && (
                <div className="flex flex-wrap gap-1">
                  {DOOR_WIDTH_PRESETS_IN.map((presetIn) => (
                    <button
                      key={presetIn}
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistory();
                        setDoorWidth(d.id, presetIn);
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
