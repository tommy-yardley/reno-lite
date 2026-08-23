import React, { useEffect, useState } from "react";
import { Lock, LockOpen, MousePointer2, Pencil, Trash2 } from "lucide-react";
import { distance } from "./geometry";
import { parseLengthInput } from "../lib/units";
import ObjectPanel from "./ObjectPanel";
import ExportPanel from "./ExportPanel";

export default function CadSidebar({ cad }) {
  const [lengthInput, setLengthInput] = useState("");
  const [nextLengthInput, setNextLengthInput] = useState("");
  const [thicknessInput, setThicknessInput] = useState("");
  const [openingWidthInput, setOpeningWidthInput] = useState("");
  const { selectedWall, nodeMap, unit } = cad;
  const start = selectedWall && nodeMap.get(selectedWall.startNodeId);
  const end = selectedWall && nodeMap.get(selectedWall.endNodeId);

  useEffect(() => {
    setLengthInput("");
    setThicknessInput("");
  }, [selectedWall?.id]);

  return (
    <aside className="space-y-6 border-r border-[#D8CCB0] bg-[#F3EEE3]/90 p-4 lg:min-h-[calc(100vh-82px)] lg:p-5">
      <section>
        <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Drawing tools</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { cad.finishWallChain(); cad.setPlacementKind(null); cad.setTool("select"); }} className="flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs" style={cad.tool === "select" ? { background: "#1B2B3A", color: "#FBF8F1", borderColor: "#1B2B3A" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}>
            <MousePointer2 size={14} /> Select
          </button>
          <button onClick={() => cad.setTool("wall")} className="flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs" style={cad.tool === "wall" ? { background: "#B8863E", color: "#FBF8F1", borderColor: "#B8863E" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}>
            <Pencil size={14} /> Wall
          </button>
          <button onClick={() => { cad.finishWallChain(); cad.setTool("door"); }} className="rounded-md border py-2 text-xs" style={cad.tool === "door" ? { background: "#B8863E", color: "#FBF8F1", borderColor: "#B8863E" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}>Door</button>
          <button onClick={() => { cad.finishWallChain(); cad.setTool("window"); }} className="rounded-md border py-2 text-xs" style={cad.tool === "window" ? { background: "#5E86A8", color: "#FBF8F1", borderColor: "#5E86A8" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}>Window</button>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[#5E86A8]">
          <input type="checkbox" checked={cad.angleSnap} onChange={(event) => cad.setAngleSnap(event.target.checked)} className="accent-[#B8863E]" />
          Snap walls every 15°
        </label>
        {cad.activeNodeId != null && (
          <div className="mt-2 space-y-2 rounded-md border border-[#D8CCB0] bg-[#FBF8F1] p-2">
            <label className="block text-[11px] text-[#5B6B78]">Next wall length ({unit === "metric" ? "m" : "ft"})</label>
            <div className="flex gap-2">
              <input
                value={nextLengthInput}
                placeholder={unit === "metric" ? "e.g. 3.25" : "e.g. 10' 8\""}
                onChange={(event) => setNextLengthInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const inches = parseLengthInput(nextLengthInput, unit);
                  if (inches) {
                    cad.addWallAtLength(inches);
                    setNextLengthInput("");
                  }
                }}
                className="mono min-w-0 flex-1 rounded border border-[#D8CCB0] px-2 py-1.5 text-xs"
              />
              <button
                onClick={() => {
                  const inches = parseLengthInput(nextLengthInput, unit);
                  if (inches) {
                    cad.addWallAtLength(inches);
                    setNextLengthInput("");
                  }
                }}
                className="rounded bg-[#B8863E] px-3 py-1.5 text-xs text-[#FBF8F1]"
              >
                Add
              </button>
            </div>
            <p className="text-[10px] leading-4 text-[#8A97A3]">Uses the live pointer direction and current 15° snap.</p>
            <button onClick={cad.finishWallChain} className="w-full rounded border border-[#D8CCB0] py-1.5 text-xs text-[#5E86A8]">Finish wall chain (Esc)</button>
          </div>
        )}
      </section>

      <ObjectPanel cad={cad} />

      {cad.designWarnings.length > 0 && (
        <section>
          <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#B2483A]">Layout checks</h2>
          <ul className="space-y-1 rounded-lg border border-[#E2A198] bg-[#FFF1EE] p-3 text-[10px] leading-4 text-[#8D342A]">
            {cad.designWarnings.map((warning, index) => <li key={`${warning}-${index}`}>• {warning}</li>)}
          </ul>
        </section>
      )}

      <ExportPanel cad={cad} />

      {cad.selectedOpening && (
        <section>
          <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Selected {cad.selectedOpening.type}</h2>
          <div className="space-y-2 rounded-lg border border-[#6FA98C] bg-[#FBF8F1] p-3">
            <label className="block text-[11px] text-[#5B6B78]">Width ({unit === "metric" ? "m" : "ft"})</label>
            <input
              value={openingWidthInput}
              placeholder={unit === "metric" ? (cad.selectedOpening.widthInches / 39.3700787).toFixed(2) : (cad.selectedOpening.widthInches / 12).toFixed(2)}
              onChange={(event) => setOpeningWidthInput(event.target.value)}
              onBlur={() => {
                const widthInches = parseLengthInput(openingWidthInput, unit);
                if (widthInches) cad.updateOpening(cad.selectedOpening.id, { widthInches });
              }}
              className="mono w-full rounded border border-[#D8CCB0] px-2 py-1.5 text-sm"
            />
            {cad.selectedOpening.type === "door" && (
              <button onClick={() => cad.updateOpening(cad.selectedOpening.id, { swing: cad.selectedOpening.swing * -1 })} className="w-full rounded border border-[#D8CCB0] py-1.5 text-xs text-[#5E86A8]">Flip door swing</button>
            )}
            <button onClick={() => cad.deleteOpening(cad.selectedOpening.id)} className="flex w-full items-center justify-center gap-1.5 rounded border border-[#B2483A] py-1.5 text-xs text-[#B2483A]"><Trash2 size={13} /> Delete</button>
          </div>
        </section>
      )}

      {cad.roomAreas.length > 0 && (
        <section>
          <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Rooms</h2>
          <div className="space-y-2">
            {cad.roomAreas.map((room) => (
              <div key={room.id} className="rounded-lg border border-[#D8CCB0] bg-[#FBF8F1] p-2.5">
                <div className="flex items-center gap-2">
                  <input value={room.name} onChange={(event) => cad.updateRoom(room.id, { name: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-medium" />
                  <button onClick={() => cad.deleteRoom(room.id)} className="text-[#B2483A]"><Trash2 size={13} /></button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <select value={room.type} onChange={(event) => cad.updateRoom(room.id, { type: event.target.value })} className="rounded border border-[#D8CCB0] bg-transparent px-1 py-0.5 text-[10px] text-[#5B6B78]">
                    {["Room", "Kitchen", "Bedroom", "Bathroom", "Living", "Hall", "Utility"].map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <span className="mono text-[10px] text-[#8A97A3]">{unit === "metric" ? `${(room.areaSqInches / (39.3700787 ** 2)).toFixed(1)} m²` : `${(room.areaSqInches / 144).toFixed(1)} ft²`}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Units</h2>
        <div className="grid grid-cols-2 gap-2">
          {[{ value: "metric", label: "m / cm" }, { value: "imperial", label: "ft / in" }].map((option) => (
            <button key={option.value} onClick={() => cad.setUnit(option.value)} className="rounded border py-1.5 text-xs" style={unit === option.value ? { borderColor: "#B8863E", color: "#B8863E" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}>{option.label}</button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[#8A97A3]">Geometry is stored in real-world inches internally; changing display units never rescales it.</p>
      </section>

      {selectedWall && start && end && (
        <section>
          <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Selected wall</h2>
          <div className="space-y-3 rounded-lg border border-[#6FA98C] bg-[#FBF8F1] p-3">
            <div>
              <label className="mb-1 block text-[11px] text-[#5B6B78]">Exact length ({unit === "metric" ? "m" : "ft"})</label>
              <input
                value={lengthInput}
                disabled={selectedWall.locked}
                placeholder={unit === "metric" ? (distance(start, end) / 39.3700787).toFixed(3) : (distance(start, end) / 12).toFixed(3)}
                onChange={(event) => setLengthInput(event.target.value)}
                onBlur={() => cad.setWallLength(selectedWall.id, parseLengthInput(lengthInput, unit))}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                className="mono w-full rounded border border-[#D8CCB0] bg-transparent px-2 py-1.5 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#5B6B78]">Thickness ({unit === "metric" ? "cm" : "in"})</label>
              <input
                value={thicknessInput}
                placeholder={unit === "metric" ? (selectedWall.thicknessInches * 2.54).toFixed(1) : selectedWall.thicknessInches.toFixed(1)}
                onChange={(event) => setThicknessInput(event.target.value)}
                onBlur={() => {
                  const value = Number(thicknessInput);
                  cad.setWallThickness(selectedWall.id, unit === "metric" ? value / 2.54 : value);
                }}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                className="mono w-full rounded border border-[#D8CCB0] bg-transparent px-2 py-1.5 text-sm"
              />
            </div>
            <button onClick={() => cad.toggleWallLock(selectedWall.id)} className="flex w-full items-center justify-center gap-2 rounded py-2 text-xs font-medium" style={{ background: selectedWall.locked ? "#5B6B78" : "#E8DFC9", color: selectedWall.locked ? "#FBF8F1" : "#1B2B3A" }}>
              {selectedWall.locked ? <Lock size={14} /> : <LockOpen size={14} />}
              {selectedWall.locked ? "Wall locked" : "Lock wall and anchors"}
            </button>
            <p className="text-[10px] leading-4 text-[#8A97A3]">Locked walls cannot be resized or moved. You can still branch a new wall from either anchor.</p>
            <button onClick={cad.deleteSelectedWall} className="flex w-full items-center justify-center gap-1.5 rounded border border-[#B2483A] py-1.5 text-xs text-[#B2483A]"><Trash2 size={13} /> Delete wall</button>
          </div>
        </section>
      )}
    </aside>
  );
}
