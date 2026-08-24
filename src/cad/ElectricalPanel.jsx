import React, { useState } from "react";
import { Trash2, Zap } from "lucide-react";
import { CIRCUIT_PRESETS } from "./electrical";

export default function ElectricalPanel({ cad }) {
  const [activeCircuitId, setActiveCircuitId] = useState(cad.electricalCircuits[0]?.id || "");
  const [wireStartId, setWireStartId] = useState(null);
  const [newCircuitPreset, setNewCircuitPreset] = useState("socketsRing");
  const selected = cad.selectedObject;
  const electricalObjects = cad.objects.filter((object) => ["Electrical", "Lighting"].includes(object.category));
  const lights = cad.objects.filter((object) => object.category === "Lighting");
  const activeCircuit = cad.electricalCircuits.find((circuit) => circuit.id === Number(activeCircuitId));
  const isElectrical = selected && ["Electrical", "Lighting"].includes(selected.category);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="mono text-[11px] uppercase tracking-widest text-[#5B6B78]">Electrical design</h2><Zap size={13} color="#D26A3D" /></div>
      <div className="space-y-2 rounded-lg border border-[#D8CCB0] bg-[#FBF8F1] p-3">
        <div className="flex gap-2"><select value={activeCircuitId} onChange={(event) => setActiveCircuitId(event.target.value)} className="min-w-0 flex-1 rounded border border-[#D8CCB0] bg-transparent px-2 py-1.5 text-xs"><option value="">Select circuit…</option>{cad.electricalCircuits.map((circuit) => <option key={circuit.id} value={circuit.id}>{circuit.name} · {circuit.ratingAmps}A</option>)}</select></div>
        <div className="grid grid-cols-[1fr_auto] gap-2"><select value={newCircuitPreset} onChange={(event) => setNewCircuitPreset(event.target.value)} className="min-w-0 rounded border border-[#D8CCB0] bg-transparent px-2 py-1.5 text-[10px]">{Object.entries(CIRCUIT_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.name} · {preset.ratingAmps}A</option>)}</select><button onClick={() => setActiveCircuitId(cad.addElectricalCircuit(newCircuitPreset))} className="rounded border border-[#D26A3D] px-3 text-[10px] text-[#D26A3D]">Add</button></div>
        {activeCircuit && <div className="grid grid-cols-[1fr_58px_30px] gap-1"><input value={activeCircuit.name} onChange={(event) => cad.updateElectricalCircuit(activeCircuit.id, { name: event.target.value })} className="min-w-0 rounded border border-[#D8CCB0] px-1 py-1 text-[10px]" /><input type="number" value={activeCircuit.ratingAmps} onChange={(event) => cad.updateElectricalCircuit(activeCircuit.id, { ratingAmps: Number(event.target.value) })} className="mono rounded border border-[#D8CCB0] px-1 py-1 text-[10px]" /><button onClick={() => { cad.deleteElectricalCircuit(activeCircuit.id); setActiveCircuitId(""); }} className="text-[#B2483A]"><Trash2 size={12} /></button></div>}
        {isElectrical && <div className="space-y-2 border-t border-[#E8DFC9] pt-2"><p className="text-[10px] font-medium text-[#1B2B3A]">Selected: {selected.name}</p><button disabled={!activeCircuit} onClick={() => cad.updateObject(selected.id, { circuitId: activeCircuit.id })} className="w-full rounded border border-[#D26A3D] py-1 text-[10px] text-[#D26A3D] disabled:opacity-40">Assign to {activeCircuit?.name || "a circuit"}</button><button onClick={() => { if (wireStartId && wireStartId !== selected.id) { cad.addElectricalRoute(wireStartId, selected.id, selected.circuitId || activeCircuit?.id); setWireStartId(null); } else setWireStartId(selected.id); }} className="w-full rounded border border-[#D8CCB0] py-1 text-[10px] text-[#5E86A8]">{wireStartId && wireStartId !== selected.id ? "Connect wire to this device" : wireStartId === selected.id ? "Wire start selected — choose another device" : "Start wiring route here"}</button>
          {["lightSwitch", "dimmer"].includes(selected.kind) && lights.length > 0 && <div><p className="mb-1 text-[9px] uppercase text-[#8A97A3]">Controls</p>{lights.map((light) => <label key={light.id} className="flex items-center gap-2 py-0.5 text-[10px] text-[#5B6B78]"><input type="checkbox" checked={(selected.controlsObjectIds || []).includes(light.id)} onChange={(event) => cad.updateObject(selected.id, { controlsObjectIds: event.target.checked ? [...(selected.controlsObjectIds || []), light.id] : (selected.controlsObjectIds || []).filter((id) => id !== light.id) })} />{light.name}</label>)}</div>}
        </div>}
        {cad.electricalRoutes.length > 0 && <div className="border-t border-[#E8DFC9] pt-2"><p className="mb-1 text-[9px] uppercase text-[#8A97A3]">Wiring routes</p>{cad.electricalRoutes.map((route) => <div key={route.id} className="flex items-center justify-between py-0.5 text-[10px] text-[#5B6B78]"><span>Route {route.id}</span><button onClick={() => cad.deleteElectricalRoute(route.id)} className="text-[#B2483A]"><Trash2 size={11} /></button></div>)}</div>}
      </div>
      <p className="mt-2 text-[9px] leading-4 text-[#8A97A3]">Concept planning only. Circuit design, protective devices, cable sizing and locations require a qualified electrician and current UK requirements.</p>
      {cad.electricalWarnings.length > 0 && <div className="mt-2 rounded border border-[#E0954A] bg-[#FFF7E8] p-2 text-[9px] leading-4 text-[#8B5A24]">{cad.electricalWarnings.slice(0, 3).map((warning) => <div key={warning}>• {warning}</div>)}</div>}
    </section>
  );
}
