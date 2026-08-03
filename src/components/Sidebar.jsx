import React, { useState, useEffect } from "react";
import UploadUnitsPanel from "./panels/UploadUnitsPanel";
import CalibrationPanel from "./panels/CalibrationPanel";
import TracePanel from "./panels/TracePanel";
import WallPanel from "./panels/WallPanel";
import RoomsPanel from "./panels/RoomsPanel";
import VoidsPanel from "./panels/VoidsPanel";
import WindowsPanel from "./panels/WindowsPanel";
import DoorsPanel from "./panels/DoorsPanel";
import FurniturePanel from "./panels/FurniturePanel";
import ShoppingListPanel from "./panels/ShoppingListPanel";
import ExportPanel from "./panels/ExportPanel";

const TABS = [
  { key: "draft", label: "Draft" },
  { key: "furnish", label: "Furnish" },
  { key: "export", label: "Export" },
];

export default function Sidebar({ fp }) {
  const [activeTab, setActiveTab] = useState("draft");
  const { selectedDoorId, selectedWindowId, selectedWallKey, selectedVertexId, selectedFurnitureId, image } = fp;

  // Selecting something on the canvas jumps to the tab that shows its editor,
  // so tapping a door/wall/furniture piece always surfaces its controls
  // instead of leaving the user to go hunt for the right tab.
  useEffect(() => {
    if (selectedDoorId != null || selectedWindowId != null || selectedWallKey != null || selectedVertexId != null) {
      setActiveTab("draft");
    }
  }, [selectedDoorId, selectedWindowId, selectedWallKey, selectedVertexId]);

  useEffect(() => {
    if (selectedFurnitureId != null) setActiveTab("furnish");
  }, [selectedFurnitureId]);

  return (
    <aside className="border-r border-[#D8CCB0] p-4 lg:p-5 space-y-4" style={{ background: "rgba(243,238,227,0.78)" }}>
      <UploadUnitsPanel fp={fp} />

      {image && (
        <>
          <div className="flex gap-1 rounded-md border p-1" style={{ borderColor: "#D8CCB0" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
                style={activeTab === t.key ? { background: "#B8863E", color: "#FBF8F1" } : { color: "#5E86A8" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "draft" && (
            <div className="space-y-6">
              <CalibrationPanel fp={fp} />
              <TracePanel fp={fp} />
              <WallPanel fp={fp} />
              <RoomsPanel fp={fp} />
              <VoidsPanel fp={fp} />
              <WindowsPanel fp={fp} />
              <DoorsPanel fp={fp} />
            </div>
          )}

          {activeTab === "furnish" && (
            <div className="space-y-6">
              <FurniturePanel fp={fp} />
              <ShoppingListPanel fp={fp} />
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-6">
              <ExportPanel fp={fp} />
            </div>
          )}
        </>
      )}
    </aside>
  );
}
