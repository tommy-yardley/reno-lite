import React from "react";
import { X, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { lengthToDisplay } from "../../lib/units";

export default function CalibrationPanel({ fp }) {
  const { image, scale, mode, startCalibration, calPoints, calLengthInput, setCalLengthInput, unit, confirmCalibration, cancelCalibration, calibrationLine, imperialFraction } = fp;

  if (!image) return null;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        02 — Set scale
      </h2>
      {!scale && mode !== "calibrating" && (
        <div className="rounded-md border p-2.5 mb-2 flex items-start gap-2" style={{ borderColor: "#B8863E", background: "rgba(184,134,62,0.08)" }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#B8863E" }} />
          <p className="text-xs" style={{ color: "#1B2B3A" }}>
            Start here — every measurement in your plan (room sizes, wall lengths, furniture fit) is calculated from this one step, so it's worth getting right before you trace anything.
          </p>
        </div>
      )}
      {!scale && mode !== "calibrating" && (
        <button onClick={startCalibration} className="w-full rounded-md py-2 text-sm font-medium" style={{ background: "#B8863E", color: "#FBF8F1" }}>
          Draw a reference line
        </button>
      )}
      {scale && mode !== "calibrating" && (
        <div className="text-xs mono flex items-center justify-between" style={{ color: "#5B6B78" }}>
          <span>calibrated · {lengthToDisplay(calibrationLine.inches, unit, unit === "imperial" && imperialFraction)} reference</span>
          <button onClick={startCalibration} className="underline flex items-center gap-1" style={{ color: "#5E86A8" }}>
            <RotateCcw size={11} /> redo
          </button>
        </div>
      )}
      {mode === "calibrating" && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "#5E86A8" }}>
            {calPoints.length < 2 ? "Click both ends of a wall whose real length you know." : "Enter that wall's real length:"}
          </p>
          {calPoints.length === 2 && (
            <div className="flex gap-2">
              <input
                autoFocus
                type="number"
                  inputMode="decimal"
                value={calLengthInput}
                onChange={(e) => setCalLengthInput(e.target.value)}
                placeholder={unit === "imperial" ? "feet" : "meters"}
                className="flex-1 rounded bg-transparent border border-[#D8CCB0] px-2 py-1 text-sm mono"
              />
              <button onClick={confirmCalibration} className="rounded px-2" style={{ background: "#B8863E", color: "#FBF8F1" }}>
                <Check size={15} />
              </button>
            </div>
          )}
          <button onClick={cancelCalibration} className="text-xs underline flex items-center gap-1" style={{ color: "#5E86A8" }}>
            <X size={11} /> cancel
          </button>
        </div>
      )}
    </section>
  );
}
