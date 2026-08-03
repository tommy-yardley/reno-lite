import React from "react";
import { RotateCw, Trash2, Wand2, AlertTriangle } from "lucide-react";
import { parseLengthInput, INCH_PER_METER } from "../../lib/units";
import { FURNITURE_PRESETS, CATEGORY_COLORS, CATEGORIES, SILL_HEIGHT_IN } from "../../lib/furnitureEngine";
import { SELECTION_COLOR } from "../../constants";

export default function FurniturePanel({ fp }) {
  const {
    rooms,
    addFurnitureRoomId,
    setAddFurnitureRoomId,
    setAutoArrangeWarning,
    furniture,
    runAutoArrange,
    autoArrangeWarning,
    selectedFurnitureId,
    setSelectedFurnitureId,
    pushHistory,
    renameFurniture,
    rotateFurniture,
    deleteFurniture,
    setFurnitureCategory,
    unit,
    setFurnitureDims,
    setFurnitureHeight,
    toggleFurnitureAvoidWindows,
    setFurnitureLink,
    furnitureWarnings,
    addFurniture,
  } = fp;

  if (rooms.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        06 — Furniture
      </h2>
      <select
        value={addFurnitureRoomId ?? ""}
        onChange={(e) => {
          setAddFurnitureRoomId(e.target.value ? Number(e.target.value) : null);
          setAutoArrangeWarning(null);
        }}
        className="w-full rounded bg-[#FBF8F1] border border-[#D8CCB0] px-2 py-1.5 text-sm mb-2"
      >
        <option value="">Choose a room…</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      {addFurnitureRoomId != null &&
        (() => {
          const room = rooms.find((r) => r.id === addFurnitureRoomId);
          if (!room) return null;
          const presets = [...(FURNITURE_PRESETS[room.type] || []), { name: "Custom item", category: "Other", width: 24, depth: 24 }];
          const roomFurniture = furniture.filter((it) => it.roomId === room.id);
          return (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] mb-1.5" style={{ color: "#8A97A3" }}>Add to {room.name}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => addFurniture(room.id, p)}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ borderColor: CATEGORY_COLORS[p.category], color: CATEGORY_COLORS[p.category] }}
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {roomFurniture.length > 0 && (
                <button
                  onClick={() => runAutoArrange(room.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium"
                  style={{ background: "#B8863E", color: "#FBF8F1" }}
                >
                  <Wand2 size={15} /> Auto-arrange this room
                </button>
              )}
              {autoArrangeWarning && (
                <p className="text-[11px] flex items-start gap-1.5" style={{ color: "#B2483A" }}>
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {autoArrangeWarning}
                </p>
              )}

              <div className="space-y-2">
                {roomFurniture.map((it) => {
                  const warn = furnitureWarnings.has(it.id);
                  return (
                    <div
                      key={it.id}
                      onClick={() => setSelectedFurnitureId(it.id)}
                      className="rounded-md border p-2 space-y-1.5 cursor-pointer"
                      style={{ borderColor: warn ? "#E0554A" : selectedFurnitureId === it.id ? SELECTION_COLOR : "#D8CCB0" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CATEGORY_COLORS[it.category] }} />
                        <input
                          value={it.name}
                          onFocus={pushHistory}
                          onChange={(e) => renameFurniture(it.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent text-sm border-none p-0 focus:outline-none"
                        />
                        <button onClick={(e) => { e.stopPropagation(); rotateFurniture(it.id); }} style={{ color: "#5E86A8" }} title="Rotate 90°">
                          <RotateCw size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteFurniture(it.id); }} style={{ color: "#B2483A" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                          value={it.category}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setFurnitureCategory(it.id, e.target.value)}
                          className="text-xs bg-[#FBF8F1] border border-[#D8CCB0] rounded px-1 py-0.5"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                  inputMode="decimal"
                          step="0.1"
                          value={unit === "imperial" ? (it.width / 12).toFixed(2) : (it.width / INCH_PER_METER).toFixed(2)}
                          onFocus={pushHistory}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const n = parseLengthInput(e.target.value, unit);
                            if (n) setFurnitureDims(it.id, n, it.depth);
                          }}
                          className="w-12 rounded bg-transparent border border-[#D8CCB0] px-1 py-0.5 text-xs mono"
                        />
                        <span className="text-[10px]" style={{ color: "#8A97A3" }}>×</span>
                        <input
                          type="number"
                  inputMode="decimal"
                          step="0.1"
                          value={unit === "imperial" ? (it.depth / 12).toFixed(2) : (it.depth / INCH_PER_METER).toFixed(2)}
                          onFocus={pushHistory}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const n = parseLengthInput(e.target.value, unit);
                            if (n) setFurnitureDims(it.id, it.width, n);
                          }}
                          className="w-12 rounded bg-transparent border border-[#D8CCB0] px-1 py-0.5 text-xs mono"
                        />
                        <span className="text-[10px]" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "ft" : "m"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: "#5E86A8" }}>Height</span>
                        <input
                          type="number"
                  inputMode="decimal"
                          step="0.1"
                          placeholder="optional"
                          value={it.height != null ? (unit === "imperial" ? (it.height / 12).toFixed(2) : (it.height / INCH_PER_METER).toFixed(2)) : ""}
                          onFocus={pushHistory}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (e.target.value === "") {
                              setFurnitureHeight(it.id, null);
                              return;
                            }
                            const n = parseLengthInput(e.target.value, unit);
                            if (n) setFurnitureHeight(it.id, n);
                          }}
                          className="w-16 rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-xs mono"
                        />
                        <span className="text-[10px]" style={{ color: "#8A97A3" }}>{unit === "imperial" ? "ft" : "m"}</span>
                        {it.height != null && (
                          <span className="text-[10px]" style={{ color: "#8A97A3" }}>({it.height > SILL_HEIGHT_IN ? "blocks a window" : "fits under a sill"})</span>
                        )}
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "#5E86A8" }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={it.avoidWindows} onChange={() => toggleFurnitureAvoidWindows(it.id)} className="accent-[#B8863E]" />
                        Avoid windows during auto-arrange{it.height != null ? " (from height)" : ""}
                      </label>
                      <input
                        value={it.link}
                        onFocus={pushHistory}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setFurnitureLink(it.id, e.target.value)}
                        placeholder="paste a link to buy this…"
                        className="w-full rounded bg-transparent border border-[#D8CCB0] px-1.5 py-0.5 text-[11px]"
                      />
                      {it.link && (
                        <a href={it.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] underline block truncate" style={{ color: "#5E86A8" }}>
                          {it.link}
                        </a>
                      )}
                      {warn && (
                        <p className="text-[10px] flex items-center gap-1" style={{ color: "#B2483A" }}>
                          <AlertTriangle size={11} /> {furnitureWarnings.get(it.id) === "outside" ? "mostly outside its room" : "overlaps something or blocks a doorway"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
    </section>
  );
}
