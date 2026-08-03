import React from "react";
import { Ruler, Undo2, Redo2 } from "lucide-react";

const STATUS_TEXT = {
  idle: "trace your floor plan photo, to real scale",
  saving: "saving…",
  saved: "all changes saved",
  "saved-no-image": "saved (photo too large to keep — geometry only)",
  error: "couldn't save — changes are only in this session",
};

export default function Header({ fp }) {
  const { image, saveStatus, canUndo, canRedo, undo, redo } = fp;

  return (
    <header className="border-b border-[#D8CCB0] px-6 py-5 flex items-center gap-3">
      <Ruler size={22} color="#B8863E" />
      <div className="flex-1">
        <h1 className="text-lg font-bold serif" style={{ letterSpacing: "0.01em" }}>
          RENO<span style={{ color: "#B8863E" }}>LITE</span>
        </h1>
        <p className="text-xs mono" style={{ color: "#5B6B78" }}>
          {image ? STATUS_TEXT[saveStatus] || STATUS_TEXT.idle : STATUS_TEXT.idle}
        </p>
      </div>
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-2 rounded border disabled:opacity-30" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
        <Undo2 size={16} />
      </button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className="p-2 rounded border disabled:opacity-30" style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}>
        <Redo2 size={16} />
      </button>
    </header>
  );
}
