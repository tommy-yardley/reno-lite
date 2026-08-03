import React from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { areaToDisplay } from "../../lib/units";

const VOID_COLOR = "#5F5347";

export default function VoidsPanel({ fp }) {
  const { voids, voidAreas, escapedVoidIds, unit, pushHistory, renameVoid, deleteVoid } = fp;

  if (voids.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        Blocked-in spaces
      </h2>
      {escapedVoidIds.size > 0 && (
        <div className="rounded-md border p-2 mb-2 flex items-start gap-1.5" style={{ borderColor: "#7A3F38", background: "rgba(224,85,74,0.08)" }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: "#B2483A" }} />
          <p className="text-xs" style={{ color: "#8B4038" }}>
            A blocked-in space (outlined in orange on the plan) isn't fully inside a room — it may have drifted, or the room around it hasn't been traced yet, so its area isn't being subtracted correctly.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {voids.map((v) => {
          const area = voidAreas.find((a) => a.id === v.id);
          const escaped = escapedVoidIds.has(v.id);
          return (
            <div key={v.id} className="rounded-md border p-2 flex items-center gap-2" style={{ borderColor: escaped ? "#E0954A" : VOID_COLOR }}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: VOID_COLOR }} />
              <div className="flex-1 min-w-0">
                <input value={v.name} onFocus={pushHistory} onChange={(e) => renameVoid(v.id, e.target.value)} className="w-full bg-transparent text-sm border-none p-0 focus:outline-none" />
                <span className="text-xs mono" style={{ color: "#9C8A78" }}>
                  {area ? areaToDisplay(area.sqInches, unit) : ""} · not livable{escaped ? " · outside its room" : ""}
                </span>
              </div>
              <button onClick={() => deleteVoid(v.id)} style={{ color: "#B2483A" }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
