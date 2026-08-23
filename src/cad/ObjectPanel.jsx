import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { CATALOG_GROUPS, OBJECT_CATALOG } from "./catalog";

export default function ObjectPanel({ cad }) {
  const [openGroup, setOpenGroup] = useState("Furniture");
  const selected = cad.selectedObject;

  return (
    <section>
      <h2 className="mono mb-2 text-[11px] uppercase tracking-widest text-[#5B6B78]">Renovation design</h2>
      <div className="mb-2 flex flex-wrap gap-1">
        {CATALOG_GROUPS.map((group) => (
          <button key={group} onClick={() => setOpenGroup(group)} className="rounded border px-2 py-1 text-[10px]" style={openGroup === group ? { borderColor: "#B8863E", color: "#B8863E" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}>{group}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(OBJECT_CATALOG).filter(([, item]) => item.category === openGroup).map(([kind, item]) => (
          <button key={kind} onClick={() => cad.beginObjectPlacement(kind)} className="rounded border border-[#D8CCB0] bg-[#FBF8F1] px-2 py-2 text-left text-[11px] text-[#5E86A8] hover:border-[#B8863E]">
            {item.label}
          </button>
        ))}
      </div>
      {cad.placementKind && (
        <div className="mt-2 rounded bg-[#E8DFC9] px-2 py-1.5 text-[10px] text-[#5B6B78]">
          {OBJECT_CATALOG[cad.placementKind].mount === "wall" ? "Click a wall to attach it." : "Click the drawing to place it."}
        </div>
      )}

      {selected && (
        <div className="mt-3 space-y-2 rounded-lg border border-[#6FA98C] bg-[#FBF8F1] p-3">
          <input value={selected.name} onChange={(event) => cad.updateObject(selected.id, { name: event.target.value })} className="w-full bg-transparent text-sm font-medium" />
          {selected.mount === "wall" && (
            <label className="block text-[10px] text-[#5B6B78]">
              Position along wall
              <input type="range" min="0.05" max="0.95" step="0.01" value={selected.t} onChange={(event) => cad.updateObject(selected.id, { t: Number(event.target.value) }, false)} className="mt-1 w-full accent-[#B8863E]" />
            </label>
          )}
          {selected.mount === "floor" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-[#5B6B78]">Width (mm)<input type="number" value={Math.round(selected.widthInches * 25.4)} onChange={(event) => cad.updateObject(selected.id, { widthInches: Number(event.target.value) / 25.4 }, false)} className="mono mt-1 w-full rounded border border-[#D8CCB0] px-1 py-1" /></label>
                <label className="text-[10px] text-[#5B6B78]">Depth (mm)<input type="number" value={Math.round(selected.depthInches * 25.4)} onChange={(event) => cad.updateObject(selected.id, { depthInches: Number(event.target.value) / 25.4 }, false)} className="mono mt-1 w-full rounded border border-[#D8CCB0] px-1 py-1" /></label>
              </div>
              <button onClick={() => cad.updateObject(selected.id, { rotation: (selected.rotation + 15) % 360 })} className="w-full rounded border border-[#D8CCB0] py-1.5 text-xs text-[#5E86A8]">Rotate 15°</button>
            </>
          )}
          <button onClick={() => cad.deleteObject(selected.id)} className="flex w-full items-center justify-center gap-1.5 rounded border border-[#B2483A] py-1.5 text-xs text-[#B2483A]"><Trash2 size={13} /> Delete object</button>
        </div>
      )}
    </section>
  );
}
