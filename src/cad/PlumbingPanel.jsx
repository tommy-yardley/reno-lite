import React, { useState } from "react";
import { Droplets, Trash2 } from "lucide-react";
import { PIPE_SYSTEMS } from "./plumbing";

export default function PlumbingPanel({ cad }) {
  const [startId, setStartId] = useState(null);
  const [system, setSystem] = useState("cold");
  const [diameterMm, setDiameterMm] = useState(15);
  const selected = cad.selectedObject;
  const isFixture = selected?.category === "Plumbing";
  return <section>
    <div className="mb-2 flex items-center justify-between"><h2 className="mono text-[11px] uppercase tracking-widest text-[#5B6B78]">Plumbing design</h2><Droplets size={13} color="#2E86C1" /></div>
    <div className="space-y-2 rounded-lg border border-[#D8CCB0] bg-[#FBF8F1] p-3">
      <div className="grid grid-cols-[1fr_72px] gap-2"><select value={system} onChange={(event) => setSystem(event.target.value)} className="rounded border border-[#D8CCB0] bg-transparent px-2 py-1.5 text-[10px]">{Object.entries(PIPE_SYSTEMS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><label className="text-[9px] text-[#8A97A3]">Pipe mm<input type="number" value={diameterMm} onChange={(event) => setDiameterMm(Number(event.target.value))} className="mono mt-0.5 w-full rounded border border-[#D8CCB0] px-1 py-1 text-[10px]" /></label></div>
      {isFixture && <button onClick={() => { if (startId && startId !== selected.id) { cad.addPlumbingRoute(startId, selected.id, system, diameterMm); setStartId(null); } else setStartId(selected.id); }} className="w-full rounded border border-[#2E86C1] py-1.5 text-[10px] text-[#2E86C1]">{startId && startId !== selected.id ? `Connect ${PIPE_SYSTEMS[system].label.toLowerCase()} pipe here` : startId === selected.id ? "Pipe start selected — choose another fixture" : "Start pipe route here"}</button>}
      {cad.plumbingRoutes.length > 0 && <div className="border-t border-[#E8DFC9] pt-2">{cad.plumbingRoutes.map((route) => <div key={route.id} className="grid grid-cols-[1fr_55px_24px] items-center gap-1 py-0.5 text-[9px]"><select value={route.system} onChange={(event) => cad.updatePlumbingRoute(route.id, { system: event.target.value })} className="min-w-0 bg-transparent text-[#5B6B78]">{Object.entries(PIPE_SYSTEMS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><span className="mono text-[#8A97A3]">Ø{route.diameterMm}</span><button onClick={() => cad.deletePlumbingRoute(route.id)} className="text-[#B2483A]"><Trash2 size={11} /></button></div>)}</div>}
    </div>
    {cad.plumbingWarnings.length > 0 && <div className="mt-2 rounded border border-[#91BFE3] bg-[#EEF7FF] p-2 text-[9px] leading-4 text-[#35698F]">{cad.plumbingWarnings.slice(0, 3).map((warning) => <div key={warning}>• {warning}</div>)}</div>}
  </section>;
}
