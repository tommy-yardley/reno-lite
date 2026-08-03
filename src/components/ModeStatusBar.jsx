import React from "react";
import { Undo2, X } from "lucide-react";
import { ROOM_TYPES } from "../constants";

const BAR_STYLE = { background: "#1B2B3A", color: "#FBF8F1" };

export default function ModeStatusBar({ fp }) {
  const {
    mode,
    drawKind,
    currentChain,
    undoLastPoint,
    cancelDrawingRoom,
    pendingRoom,
    roomNameInput,
    setRoomNameInput,
    roomTypeInput,
    setRoomTypeInput,
    confirmRoomName,
    cancelRoomName,
    cancelCalibration,
    calPoints,
    togglePlacingDoor,
    togglePlacingWindow,
  } = fp;

  if (mode === "idle") return null;

  if (mode === "calibrating") {
    return (
      <div className="mb-3 rounded-md p-3 flex items-center justify-between gap-3" style={BAR_STYLE}>
        <span className="text-sm">
          {calPoints.length < 2 ? "Calibrating — click both ends of a wall you know the length of" : "Enter the real length in the panel below"}
        </span>
        <button onClick={cancelCalibration} className="text-xs underline shrink-0">Cancel</button>
      </div>
    );
  }

  if (mode === "drawing") {
    return (
      <div className="mb-3 rounded-md p-3" style={BAR_STYLE}>
        <p className="text-sm">
          Tracing a {drawKind === "void" ? "blocked-in space" : "room"} — {currentChain.length} point{currentChain.length === 1 ? "" : "s"} so far. Click back on the start to close it.
        </p>
        <div className="flex gap-2 mt-2">
          <button onClick={undoLastPoint} className="flex-1 flex items-center justify-center gap-1 rounded border py-1.5 text-xs" style={{ borderColor: "#5E86A8" }}>
            <Undo2 size={12} /> Undo point
          </button>
          <button onClick={cancelDrawingRoom} className="flex-1 flex items-center justify-center gap-1 rounded border py-1.5 text-xs" style={{ borderColor: "#E0A296", color: "#E0A296" }}>
            <X size={12} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "naming" && pendingRoom) {
    return (
      <div className="mb-3 rounded-md p-3 space-y-2" style={BAR_STYLE}>
        <p className="text-sm font-medium">{pendingRoom.kind === "void" ? "Name this blocked-in space" : "Name this room"}</p>
        <input
          autoFocus
          value={roomNameInput}
          onChange={(e) => setRoomNameInput(e.target.value)}
          className="w-full rounded px-2 py-1.5 text-sm"
          style={{ color: "#1B2B3A", background: "#FBF8F1" }}
          placeholder={pendingRoom.kind === "void" ? "e.g. Chimney breast" : "Room name"}
        />
        {pendingRoom.kind !== "void" && (
          <select value={roomTypeInput} onChange={(e) => setRoomTypeInput(e.target.value)} className="w-full rounded px-2 py-1.5 text-sm" style={{ color: "#1B2B3A", background: "#FBF8F1" }}>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={confirmRoomName} className="flex-1 rounded py-1.5 text-xs font-medium" style={{ background: "#B8863E", color: "#1B2B3A" }}>
            {pendingRoom.kind === "void" ? "Save blocked space" : "Save room"}
          </button>
          <button onClick={cancelRoomName} className="rounded border px-2 text-xs" style={{ borderColor: "#5E86A8" }}>
            back
          </button>
        </div>
      </div>
    );
  }

  if (mode === "placingDoor" || mode === "placingWindow") {
    return (
      <div className="mb-3 rounded-md p-3 flex items-center justify-between gap-3" style={BAR_STYLE}>
        <span className="text-sm">{mode === "placingDoor" ? "Placing doors — tap a wall to add one" : "Placing windows — tap a wall to add one"}</span>
        <button onClick={mode === "placingDoor" ? togglePlacingDoor : togglePlacingWindow} className="text-xs underline shrink-0">
          Done
        </button>
      </div>
    );
  }

  return null;
}
