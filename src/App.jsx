import React from "react";
import { useFloorplanState } from "./hooks/useFloorplanState";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import FloorplanCanvas from "./components/canvas/FloorplanCanvas";
import ModeStatusBar from "./components/ModeStatusBar";

export default function App() {
  const fp = useFloorplanState();

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "linear-gradient(180deg, #F3EEE3 0%, #ECE4D2 100%)", fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui", color: "#1B2B3A" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Zilla+Slab:wght@500;600;700&display=swap');
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .serif { font-family: 'Zilla Slab', serif; }
        select { color-scheme: light; }
      `}</style>

      <Header fp={fp} />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-0">
        {/* order-1/2 (not DOM position) controls stacking, so canvas comes first on
            phones — where this is one stacked column — but sidebar stays on the
            left on desktop, where there's room for both side by side. */}
        <main className="order-1 lg:order-2 p-6">
          <ModeStatusBar fp={fp} />
          <FloorplanCanvas fp={fp} />
        </main>
        <div className="order-2 lg:order-1">
          <Sidebar fp={fp} />
        </div>
      </div>
    </div>
  );
}
