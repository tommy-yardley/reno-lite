import React from "react";
import { X, Trash2 } from "lucide-react";
import { dist } from "../../lib/geometry";
import { lengthToDisplay, parseLengthInput, INCH_PER_METER } from "../../lib/units";

export default function WallPanel({ fp }) {
  const {
    selectedWall,
    selectedWallKey,
    setSelectedWallKey,
    wallLengthInput,
    setWallLengthInput,
    setWallLength,
    unit,
    imperialFraction,
    getWallProps,
    setWallThickness,
    toggleWallOpen,
    scale,
    pushHistory,
    wallSegments,
    wallLoopCounts,
    extBatchInput,
    setExtBatchInput,
    intBatchInput,
    setIntBatchInput,
    applyExteriorThickness,
    applyInteriorThickness,
    selectedVertexId,
    setSelectedVertexId,
    canDeleteSelectedVertex,
    deleteVertexEverywhere,
  } = fp;

  return (
    <>
      {selectedWall && (
        <section>
          <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
            Selected wall
          </h2>
          <div className="rounded-md border p-2.5 space-y-2" style={{ borderColor: "#6FA98C" }}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                  inputMode="decimal"
                step="0.1"
                placeholder={lengthToDisplay(dist(selectedWall.a, selectedWall.b) * scale, unit, unit === "imperial" && imperialFraction)}
                value={wallLengthInput}
                onFocus={() => {
                  pushHistory();
                  setWallLengthInput(((dist(selectedWall.a, selectedWall.b) * scale) / (unit === "imperial" ? 12 : INCH_PER_METER)).toFixed(2));
                }}
                onChange={(e) => {
                  setWallLengthInput(e.target.value);
                  const inches = parseLengthInput(e.target.value, unit);
                  if (inches) setWallLength(selectedWall.key, inches);
                }}
                className="flex-1 rounded bg-transparent border border-[#D8CCB0] px-2 py-1 text-sm mono"
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "ft" : "m"}</span>
              <button onClick={() => setSelectedWallKey(null)} style={{ color: "#5E86A8" }}>
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px]" style={{ color: "#8A97A3" }}>
              Sets the exact length by sliding this wall's far corner — drag corners directly if you want to move the other end instead.
            </p>

            {!getWallProps(selectedWall.key).open && (
              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "#D8CCB0" }}>
                <span className="text-xs" style={{ color: "#5E86A8" }}>Thickness</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={unit === "imperial" ? getWallProps(selectedWall.key).thickness.toFixed(1) : (getWallProps(selectedWall.key).thickness * 2.54).toFixed(1)}
                  onFocus={pushHistory}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n)) setWallThickness(selectedWall.key, unit === "imperial" ? n : n / 2.54);
                  }}
                  className="w-16 rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-xs mono"
                />
                <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "in" : "cm"}</span>
              </div>
            )}
            <button onClick={() => toggleWallOpen(selectedWall.key)} className="w-full rounded border py-1.5 text-xs" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
              {getWallProps(selectedWall.key).open ? "Make this a real wall" : "Mark as open (no wall here)"}
            </button>
          </div>
        </section>
      )}

      {wallSegments.length > 1 && (
        <section>
          <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
            Batch wall thickness
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1" style={{ color: "#5E86A8" }}>
                Exterior walls ({Object.values(wallLoopCounts).filter((c) => c <= 1).length || wallSegments.length})
              </span>
              <input
                type="number"
                  inputMode="decimal"
                step="0.5"
                placeholder={unit === "imperial" ? "6" : "15"}
                value={extBatchInput}
                onChange={(e) => setExtBatchInput(e.target.value)}
                className="w-14 rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-xs mono"
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "in" : "cm"}</span>
              <button
                onClick={() => {
                  const n = parseFloat(extBatchInput);
                  if (!isNaN(n)) applyExteriorThickness(unit === "imperial" ? n : n / 2.54);
                }}
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ background: "#B8863E", color: "#FBF8F1" }}
              >
                Apply
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1" style={{ color: "#5E86A8" }}>
                Interior walls ({Object.values(wallLoopCounts).filter((c) => c >= 2).length})
              </span>
              <input
                type="number"
                  inputMode="decimal"
                step="0.5"
                placeholder={unit === "imperial" ? "4.5" : "11"}
                value={intBatchInput}
                onChange={(e) => setIntBatchInput(e.target.value)}
                className="w-14 rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-xs mono"
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "in" : "cm"}</span>
              <button
                onClick={() => {
                  const n = parseFloat(intBatchInput);
                  if (!isNaN(n)) applyInteriorThickness(unit === "imperial" ? n : n / 2.54);
                }}
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ background: "#B8863E", color: "#FBF8F1" }}
              >
                Apply
              </button>
            </div>
            <p className="text-[11px]" style={{ color: "#8A97A3" }}>
              "Exterior" means a wall bordering only one room; "interior" means it's shared between two. Walls marked open are skipped.
            </p>
          </div>
        </section>
      )}

      {selectedVertexId != null && (
        <section>
          <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
            Selected corner
          </h2>
          <div className="rounded-md border p-2.5 space-y-2" style={{ borderColor: "#6FA98C" }}>
            <p className="text-xs" style={{ color: "#5E86A8" }}>
              Tap a corner (without dragging it) to select it here. Deleting it straightens the wall on every room it touches.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteVertexEverywhere(selectedVertexId)}
                disabled={!canDeleteSelectedVertex}
                className="flex-1 flex items-center justify-center gap-1 rounded py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ background: "#E0554A", color: "#FBF8F1" }}
              >
                <Trash2 size={13} /> Delete corner
              </button>
              <button onClick={() => setSelectedVertexId(null)} className="rounded border px-2 text-xs" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
                <X size={14} />
              </button>
            </div>
            {!canDeleteSelectedVertex && (
              <p className="text-[11px]" style={{ color: "#B2483A" }}>
                Can't remove — a room or blocked-in space using this corner only has 3 sides left.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
