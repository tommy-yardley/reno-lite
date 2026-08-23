import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { CATALOG_GROUPS, OBJECT_CATALOG } from "./catalog";

export default function ObjectPanel({ cad }) {
  const [openGroup, setOpenGroup] = useState("Living");
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
          <div className="border-t border-[#E8DFC9] pt-2">
            <p className="mono mb-1.5 text-[9px] uppercase text-[#8A97A3]">Specification</p>
            <div className="space-y-1.5">
              <select value={selected.roomId || ""} onChange={(event) => cad.updateObject(selected.id, { roomId: Number(event.target.value) || null })} className="w-full rounded border border-[#D8CCB0] bg-transparent px-2 py-1 text-[10px]"><option value="">No room assigned</option>{cad.rooms.filter((room) => room.classification !== "void").map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
              <input value={selected.supplier || ""} placeholder="Supplier" onChange={(event) => cad.updateObject(selected.id, { supplier: event.target.value }, false)} className="w-full rounded border border-[#D8CCB0] px-2 py-1 text-[10px]" />
              <input value={selected.productUrl || ""} placeholder="Product URL" onChange={(event) => cad.updateObject(selected.id, { productUrl: event.target.value }, false)} className="w-full rounded border border-[#D8CCB0] px-2 py-1 text-[10px]" />
              <div className="grid grid-cols-2 gap-2"><label className="text-[9px] text-[#8A97A3]">Price £<input type="number" step="0.01" value={((selected.pricePence || 0) / 100).toFixed(2)} onChange={(event) => cad.updateObject(selected.id, { pricePence: Math.round(Number(event.target.value) * 100) }, false)} className="mono mt-0.5 w-full rounded border border-[#D8CCB0] px-1 py-1 text-[10px]" /></label><label className="text-[9px] text-[#8A97A3]">Status<select value={selected.procurementStatus || "proposed"} onChange={(event) => cad.updateObject(selected.id, { procurementStatus: event.target.value })} className="mt-0.5 w-full rounded border border-[#D8CCB0] bg-transparent px-1 py-1 text-[10px]">{["existing", "retained", "proposed", "purchased", "installed"].map((status) => <option key={status}>{status}</option>)}</select></label></div>
            </div>
          </div>
          <button onClick={() => cad.deleteObject(selected.id)} className="flex w-full items-center justify-center gap-1.5 rounded border border-[#B2483A] py-1.5 text-xs text-[#B2483A]"><Trash2 size={13} /> Delete object</button>
        </div>
      )}
    </section>
  );
}
