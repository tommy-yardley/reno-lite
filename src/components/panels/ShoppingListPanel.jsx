import React from "react";
import { INCH_PER_METER } from "../../lib/units";
import { CATEGORY_COLORS } from "../../lib/furnitureEngine";

export default function ShoppingListPanel({ fp }) {
  const { rooms, furniture, unit } = fp;

  if (furniture.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        Shopping list
      </h2>
      <div className="space-y-3">
        {rooms
          .filter((room) => furniture.some((it) => it.roomId === room.id))
          .map((room) => (
            <div key={room.id}>
              <p className="text-[11px] font-medium mb-1" style={{ color: room.color }}>{room.name}</p>
              <div className="space-y-1">
                {furniture
                  .filter((it) => it.roomId === room.id)
                  .map((it) => (
                    <div key={it.id} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: CATEGORY_COLORS[it.category] }} />
                      <span className="flex-1 min-w-0 truncate" style={{ color: "#1B2B3A" }}>
                        {it.name}{" "}
                        <span className="mono" style={{ color: "#5B6B78" }}>
                          (
                          {unit === "imperial"
                            ? `${(it.width / 12).toFixed(1)}×${(it.depth / 12).toFixed(1)}${it.height != null ? `×${(it.height / 12).toFixed(1)}` : ""}ft`
                            : `${(it.width / INCH_PER_METER).toFixed(1)}×${(it.depth / INCH_PER_METER).toFixed(1)}${it.height != null ? `×${(it.height / INCH_PER_METER).toFixed(1)}` : ""}m`}
                          )
                        </span>
                      </span>
                      {it.link ? (
                        <a href={it.link} target="_blank" rel="noreferrer" className="underline shrink-0" style={{ color: "#5E86A8" }}>
                          buy
                        </a>
                      ) : (
                        <span className="shrink-0 text-[10px]" style={{ color: "#8A97A3" }}>no link</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
