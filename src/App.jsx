import React, { useEffect, useState } from "react";
import { Image, Redo2, Ruler, Undo2, X } from "lucide-react";
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
  const [referenceOpen, setReferenceOpen] = useState(false);

  // Deleting the final wall removes its nodes as well. If the wall tool was in
  // the middle of a chain, its active node can otherwise point at a node that no
  // longer exists, causing the next wall to be created from a stale anchor.
  useEffect(() => {
    if (cad.activeNodeId != null && !cad.nodeMap.has(cad.activeNodeId)) cad.finishWallChain();
  }, [cad.activeNodeId, cad.nodeMap, cad.finishWallChain]);

  return (
    <div className="h-dvh w-full overflow-hidden bg-[linear-gradient(180deg,#F3EEE3_0%,#ECE4D2_100%)] text-[#1B2B3A]" style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Zilla+Slab:wght@500;600;700&display=swap');
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .serif { font-family: 'Zilla Slab', serif; }
      `}</style>

      <header className="flex h-16 items-center gap-2 border-b border-[#D8CCB0] bg-[#F3EEE3]/95 px-3 sm:gap-3 sm:px-5">
        <Ruler size={22} color="#B8863E" />
        <div className="flex-1">
          <h1 className="serif text-lg font-bold">RENO<span className="text-[#B8863E]">LITE</span></h1>
          <p className="mono hidden text-[11px] text-[#5B6B78] sm:block">{SAVE_LABEL[cad.saveStatus]}</p>
        </div>
        <button onClick={() => setReferenceOpen(true)} title="Open reference plan" className="flex items-center gap-1.5 rounded border border-[#D8CCB0] p-2 text-[#5E86A8] sm:px-3"><Image size={16} /><span className="hidden text-xs sm:inline">Reference</span></button>
        <button onClick={cad.undo} disabled={!cad.canUndo} title="Undo" className="rounded border border-[#D8CCB0] p-2 text-[#5E86A8] disabled:opacity-30"><Undo2 size={16} /></button>
        <button onClick={cad.redo} disabled={!cad.canRedo} title="Redo" className="rounded border border-[#D8CCB0] p-2 text-[#5E86A8] disabled:opacity-30"><Redo2 size={16} /></button>
      </header>

      <main className="grid h-[calc(100dvh-64px)] min-h-0 grid-rows-[minmax(260px,56dvh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
        <div className="min-h-0 min-w-0 p-2 sm:p-3 lg:p-4"><CadCanvas cad={cad} /></div>
        <div className="min-h-0 border-t border-[#D8CCB0] lg:border-l lg:border-t-0"><CadSidebar cad={cad} /></div>
      </main>

      {referenceOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1B2B3A]/35 p-2 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-label="Reference plan">
          <div className="flex h-full w-full max-w-md min-w-0 flex-col gap-2">
            <button onClick={() => setReferenceOpen(false)} className="ml-auto flex items-center gap-1.5 rounded-md bg-[#1B2B3A] px-3 py-2 text-xs text-[#FBF8F1]"><X size={15} /> Close</button>
            <div className="min-h-0 flex-1"><ReferencePanel cad={cad} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
