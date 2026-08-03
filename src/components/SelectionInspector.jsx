import React from "react";
import { FlipHorizontal2, RotateCw, Trash2, X } from "lucide-react";
import { dist } from "../lib/geometry";
import { INCH_PER_METER, lengthToDisplay, parseLengthInput } from "../lib/units";

function displayLengthInput(inches, unit) {
  if (!Number.isFinite(inches)) return "";
  return unit === "imperial" ? (inches / 12).toFixed(2) : (inches / INCH_PER_METER).toFixed(2);
}

function Field({ label, children }) {
  return (
    <label className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 text-xs">
      <span style={{ color: "#5B6B78" }}>{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-md bg-white/70 border border-[#D8CCB0] px-2 py-1.5 text-sm mono focus:outline-none focus:ring-2 focus:ring-[#6FA98C]/40";

export default function SelectionInspector({ fp }) {
  const {
    mode,
    unit,
    imperialFraction,
    scale,
    selectedWall,
    selectedWallKey,
    setSelectedWallKey,
    wallLengthInput,
    setWallLengthInput,
    setWallLength,
    getWallProps,
    setWallThickness,
    toggleWallOpen,
    windows,
    selectedWindowId,
    setSelectedWindowId,
    setWindowWidth,
    deleteWindow,
    doors,
    selectedDoorId,
    setSelectedDoorId,
    setDoorWidth,
    deleteDoor,
    flipDoorHinge,
    mirrorDoorSwing,
    furniture,
    selectedFurnitureId,
    setSelectedFurnitureId,
    renameFurniture,
    setFurnitureDims,
    rotateFurniture,
    deleteFurniture,
    selectedVertexId,
    setSelectedVertexId,
    canDeleteSelectedVertex,
    deleteVertexEverywhere,
    pushHistory,
  } = fp;

  if (mode !== "idle") return null;

  const selectedWindow = windows.find((item) => item.id === selectedWindowId);
  const selectedDoor = doors.find((item) => item.id === selectedDoorId);
  const selectedFurniture = furniture.find((item) => item.id === selectedFurnitureId);
  const hasSelection = selectedWall || selectedWindow || selectedDoor || selectedFurniture || selectedVertexId != null;
  if (!hasSelection) return null;

  const close = () => {
    setSelectedWallKey(null);
    setSelectedWindowId(null);
    setSelectedDoorId(null);
    setSelectedFurnitureId(null);
    setSelectedVertexId(null);
    setWallLengthInput("");
  };

  let title = "Edit selection";
  if (selectedWall) title = "Edit wall";
  else if (selectedWindow) title = "Edit window";
  else if (selectedDoor) title = "Edit door";
  else if (selectedFurniture) title = "Edit item";
  else if (selectedVertexId != null) title = "Edit corner";

  const unitLabel = unit === "imperial" ? "ft" : "m";

  return (
    <section
      className="fixed inset-x-3 bottom-3 z-40 max-h-[72vh] overflow-y-auto rounded-xl border p-4 shadow-2xl lg:absolute lg:inset-auto lg:right-4 lg:top-4 lg:w-[330px]"
      style={{ background: "rgba(251,248,241,0.97)", borderColor: "#6FA98C", backdropFilter: "blur(12px)" }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="serif text-lg font-semibold" style={{ color: "#1B2B3A" }}>{title}</p>
          <p className="text-[11px]" style={{ color: "#8A97A3" }}>Changes update the plan immediately.</p>
        </div>
        <button type="button" onClick={close} className="rounded-md p-1.5 hover:bg-black/5" aria-label="Close editor" style={{ color: "#5E86A8" }}>
          <X size={18} />
        </button>
      </div>

      {selectedWall && (
        <div className="space-y-3">
          <Field label="Length">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={wallLengthInput || displayLengthInput(dist(selectedWall.a, selectedWall.b) * scale, unit)}
                placeholder={lengthToDisplay(dist(selectedWall.a, selectedWall.b) * scale, unit, unit === "imperial" && imperialFraction)}
                onFocus={() => {
                  pushHistory();
                  if (!wallLengthInput) setWallLengthInput(displayLengthInput(dist(selectedWall.a, selectedWall.b) * scale, unit));
                }}
                onChange={(event) => {
                  setWallLengthInput(event.target.value);
                  const inches = parseLengthInput(event.target.value, unit);
                  if (inches && selectedWallKey) setWallLength(selectedWallKey, inches);
                }}
                className={inputClass}
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unitLabel}</span>
            </div>
          </Field>
          {!getWallProps(selectedWall.key).open && (
            <Field label="Thickness">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={unit === "imperial" ? getWallProps(selectedWall.key).thickness.toFixed(1) : (getWallProps(selectedWall.key).thickness * 2.54).toFixed(1)}
                  onFocus={pushHistory}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    if (Number.isFinite(value)) setWallThickness(selectedWall.key, unit === "imperial" ? value : value / 2.54);
                  }}
                  className={inputClass}
                />
                <span className="text-xs" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "in" : "cm"}</span>
              </div>
            </Field>
          )}
          <button type="button" onClick={() => toggleWallOpen(selectedWall.key)} className="w-full rounded-md border py-2 text-sm font-medium" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
            {getWallProps(selectedWall.key).open ? "Make this a solid wall" : "Mark as an open boundary"}
          </button>
        </div>
      )}

      {selectedWindow && (
        <div className="space-y-3">
          <Field label="Width">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={displayLengthInput(selectedWindow.widthInches, unit)}
                onFocus={pushHistory}
                onChange={(event) => setWindowWidth(selectedWindow.id, parseLengthInput(event.target.value, unit) ?? selectedWindow.widthInches)}
                className={inputClass}
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unitLabel}</span>
            </div>
          </Field>
          <button type="button" onClick={() => deleteWindow(selectedWindow.id)} className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium" style={{ background: "#E0554A", color: "#FBF8F1" }}>
            <Trash2 size={15} /> Delete window
          </button>
        </div>
      )}

      {selectedDoor && (
        <div className="space-y-3">
          <Field label="Width">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={displayLengthInput(selectedDoor.widthInches, unit)}
                onFocus={pushHistory}
                onChange={(event) => setDoorWidth(selectedDoor.id, parseLengthInput(event.target.value, unit) ?? selectedDoor.widthInches)}
                className={inputClass}
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unitLabel}</span>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => flipDoorHinge(selectedDoor.id)} className="flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
              <FlipHorizontal2 size={14} /> Flip hinge
            </button>
            <button type="button" onClick={() => mirrorDoorSwing(selectedDoor.id)} className="flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
              <RotateCw size={14} /> Mirror swing
            </button>
          </div>
          <button type="button" onClick={() => deleteDoor(selectedDoor.id)} className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium" style={{ background: "#E0554A", color: "#FBF8F1" }}>
            <Trash2 size={15} /> Delete door
          </button>
        </div>
      )}

      {selectedFurniture && (
        <div className="space-y-3">
          <Field label="Name">
            <input value={selectedFurniture.name} onFocus={pushHistory} onChange={(event) => renameFurniture(selectedFurniture.id, event.target.value)} className={inputClass} />
          </Field>
          <Field label="Size">
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={displayLengthInput(selectedFurniture.width, unit)}
                onFocus={pushHistory}
                onChange={(event) => {
                  const value = parseLengthInput(event.target.value, unit);
                  if (value) setFurnitureDims(selectedFurniture.id, value, selectedFurniture.depth);
                }}
                className={inputClass}
              />
              <span style={{ color: "#8A97A3" }}>×</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={displayLengthInput(selectedFurniture.depth, unit)}
                onFocus={pushHistory}
                onChange={(event) => {
                  const value = parseLengthInput(event.target.value, unit);
                  if (value) setFurnitureDims(selectedFurniture.id, selectedFurniture.width, value);
                }}
                className={inputClass}
              />
              <span className="text-xs" style={{ color: "#8A97A3" }}>{unitLabel}</span>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => rotateFurniture(selectedFurniture.id)} className="flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
              <RotateCw size={14} /> Rotate 90°
            </button>
            <button type="button" onClick={() => deleteFurniture(selectedFurniture.id)} className="flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium" style={{ background: "#E0554A", color: "#FBF8F1" }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}

      {selectedVertexId != null && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "#5B6B78" }}>Moving or deleting this corner updates every room that shares it.</p>
          <button
            type="button"
            disabled={!canDeleteSelectedVertex}
            onClick={() => deleteVertexEverywhere(selectedVertexId)}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: "#E0554A", color: "#FBF8F1" }}
          >
            <Trash2 size={15} /> Delete corner
          </button>
        </div>
      )}
    </section>
  );
}
