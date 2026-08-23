import React from "react";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";

export const LAYERS = [
  ["architecture", "Architecture"],
  ["furniture", "Furniture"],
  ["electrical", "Electrical"],
  ["plumbing", "Plumbing"],
  ["dimensions", "Dimensions"],
  ["annotations", "Annotations"],
  ["reference", "Reference"],
];

export default function LayerPanel({ cad }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="mono text-[11px] uppercase tracking-widest text-[#5B6B78]">Layers</h2><button onClick={() => cad.setActiveLayer(null)} className="text-[10px] text-[#5E86A8]">Show normally</button></div>
      <div className="overflow-hidden rounded-lg border border-[#D8CCB0] bg-[#FBF8F1]">
        {LAYERS.map(([key, label]) => {
          const settings = cad.layerSettings[key];
          const active = cad.activeLayer === key;
          return <div key={key} className="flex items-center gap-1 border-b border-[#E8DFC9] px-2 py-1.5 last:border-b-0" style={active ? { background: "#E8DFC9" } : undefined}>
            <button onClick={() => cad.updateLayer(key, { visible: !settings.visible })} className="p-1 text-[#5E86A8]" title={settings.visible ? "Hide layer" : "Show layer"}>{settings.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
            <button onClick={() => cad.updateLayer(key, { locked: !settings.locked })} className="p-1 text-[#5E86A8]" title={settings.locked ? "Unlock layer" : "Lock layer"}>{settings.locked ? <Lock size={12} /> : <LockOpen size={12} />}</button>
            <button onClick={() => cad.setActiveLayer(active ? null : key)} className="flex-1 text-left text-[10px] text-[#1B2B3A]">{label}</button>
            {active && <span className="mono text-[8px] uppercase text-[#B8863E]">focus</span>}
          </div>;
        })}
      </div>
      <p className="mt-1.5 text-[9px] leading-4 text-[#8A97A3]">Focus a discipline to dim the others. Hidden layers are omitted from clean exports.</p>
    </section>
  );
}
