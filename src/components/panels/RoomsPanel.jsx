import React from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { areaToDisplay } from "../../lib/units";
import { ROOM_TYPES } from "../../constants";

export default function RoomsPanel({ fp }) {
  const { rooms, roomAreas, overlappingRoomIds, showInteriorArea, setShowInteriorArea, totalAreaSqInches, totalInteriorSqInches, unit, pushHistory, renameRoom, retypeRoom, deleteRoom } = fp;

  if (rooms.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        Rooms &amp; area
      </h2>
      <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer" style={{ color: "#5E86A8" }}>
        <input type="checkbox" checked={showInteriorArea} onChange={(e) => setShowInteriorArea(e.target.checked)} className="accent-[#B8863E]" />
        Show interior (clear) area, minus wall thickness
      </label>
      {overlappingRoomIds.size > 0 && (
        <div className="rounded-md border p-2 mb-2 flex items-start gap-1.5" style={{ borderColor: "#7A3F38", background: "rgba(224,85,74,0.08)" }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: "#B2483A" }} />
          <p className="text-xs" style={{ color: "#8B4038" }}>
            Some rooms overlap (outlined in red on the plan) — their areas are still counted separately, which double-counts that space.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {rooms.map((room) => {
          const area = roomAreas.find((r) => r.id === room.id);
          const overlapping = overlappingRoomIds.has(room.id);
          const displayed = area ? (showInteriorArea ? area.interiorSqInches : area.sqInches) : 0;
          return (
            <div key={room.id} className="rounded-md border p-2 flex items-center gap-2" style={{ borderColor: overlapping ? "#E0554A" : "#D8CCB0" }}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: room.color }} />
              <div className="flex-1 min-w-0">
                <input value={room.name} onFocus={pushHistory} onChange={(e) => renameRoom(room.id, e.target.value)} className="w-full bg-transparent text-sm border-none p-0 focus:outline-none" />
                <div className="flex items-center justify-between">
                  <select value={room.type} onChange={(e) => retypeRoom(room.id, e.target.value)} className="text-xs bg-transparent border-none p-0" style={{ color: "#5B6B78" }}>
                    {ROOM_TYPES.map((t) => (
                      <option key={t} value={t} style={{ background: "#FBF8F1" }}>{t}</option>
                    ))}
                  </select>
                  <span className="text-xs mono" style={{ color: "#5B6B78" }}>{area ? areaToDisplay(displayed, unit) : ""}</span>
                </div>
                {area && area.grossSqInches - area.sqInches > 1 && (
                  <span className="text-[10px]" style={{ color: "#9C8A78" }}>
                    ({areaToDisplay(area.grossSqInches - area.sqInches, unit)} blocked in, already excluded)
                  </span>
                )}
              </div>
              <button onClick={() => deleteRoom(room.id)} style={{ color: "#B2483A" }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-2 border-t flex items-center justify-between text-sm" style={{ borderColor: "#D8CCB0" }}>
        <span style={{ color: "#5B6B78" }}>Total floorplan {showInteriorArea ? "(interior)" : "(centerline)"}</span>
        <span className="mono font-medium">{areaToDisplay(showInteriorArea ? totalInteriorSqInches : totalAreaSqInches, unit)}</span>
      </div>
      {showInteriorArea && (
        <p className="text-[10px] mt-1" style={{ color: "#8A97A3" }}>
          Interior area follows the inside wall faces, including mitered corners. Overlapping rooms are still counted separately.
        </p>
      )}
    </section>
  );
}
