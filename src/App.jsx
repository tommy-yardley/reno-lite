import React from "react";
import { Redo2, Ruler, Undo2 } from "lucide-react";
import CadCanvas from "./cad/CadCanvas";
import CadSidebar from "./cad/CadSidebar";
import ReferencePanel from "./cad/ReferencePanel";
import { useCadState } from "./cad/useCadState";

const SAVE_LABEL = {
  idle: "measured CAD workspace",
  saving: "saving…",
  saved: "all changes saved",
  error: "could not save locally",
};

export default function App() {
  const cad = useCadState();

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(180deg,#F3EEE3_0%,#ECE4D2_100%)] text-[#1B2B3A]" style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Zilla+Slab:wght@500;600;700&display=swap');
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .serif { font-family: 'Zilla Slab', serif; }
      `}</style>

      <header className="flex items-center gap-3 border-b border-[#D8CCB0] px-4 py-4 sm:px-6">
        <Ruler size={22} color="#B8863E" />
        <div className="flex-1">
          <h1 className="serif text-lg font-bold">RENO<span className="text-[#B8863E]">LITE</span></h1>
          <p className="mono text-[11px] text-[#5B6B78]">{SAVE_LABEL[cad.saveStatus]}</p>
        </div>
        <button onClick={cad.undo} disabled={!cad.canUndo} title="Undo" className="rounded border border-[#D8CCB0] p-2 text-[#5E86A8] disabled:opacity-30"><Undo2 size={16} /></button>
        <button onClick={cad.redo} disabled={!cad.canRedo} title="Redo" className="rounded border border-[#D8CCB0] p-2 text-[#5E86A8] disabled:opacity-30"><Redo2 size={16} /></button>
      </header>

      <div className="grid grid-cols-1 items-start lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="order-2 lg:order-1 lg:sticky lg:top-0"><CadSidebar cad={cad} /></div>
        <main className="order-1 min-w-0 p-3 sm:p-4 lg:order-2 lg:p-5">
          <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <CadCanvas cad={cad} />
            <ReferencePanel cad={cad} />
          </div>
        </main>
      </div>
    </div>
  );
}
