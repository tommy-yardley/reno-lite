import React from "react";
import { Upload, Camera as CameraIcon } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { formatFeetInchesFraction } from "../../lib/units";

export default function UploadUnitsPanel({ fp }) {
  const { image, handleImageUpload, fileInputRef, handleCameraCapture, unit, setUnit, imperialFraction, setImperialFraction } = fp;

  return (
    <section>
      <h2 className="text-xs mono uppercase tracking-widest mb-2" style={{ color: "#5B6B78" }}>
        01 — Upload &amp; units
      </h2>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-md py-4 cursor-pointer"
        style={{ borderColor: "#D8CCB0" }}
      >
        <Upload size={16} color="#5E86A8" />
        <span className="text-sm" style={{ color: "#5E86A8" }}>{image ? "Replace photo" : "Upload floor plan photo"}</span>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {Capacitor.isNativePlatform() && (
        <button
          type="button"
          onClick={handleCameraCapture}
          className="w-full flex items-center justify-center gap-2 rounded-md py-2 mt-2 text-sm border"
          style={{ borderColor: "#D8CCB0", color: "#5E86A8" }}
        >
          <CameraIcon size={15} /> Take a photo
        </button>
      )}

      <div className="flex gap-1.5 mt-3">
        {["imperial", "metric"].map((u) => (
          <button
            key={u}
            onClick={() => setUnit(u)}
            className="flex-1 px-2 py-1.5 rounded text-xs font-medium border"
            style={unit === u ? { background: "#B8863E", color: "#FBF8F1", borderColor: "#B8863E" } : { borderColor: "#D8CCB0", color: "#5E86A8" }}
          >
            {u === "imperial" ? "ft / in" : "m / cm"}
          </button>
        ))}
      </div>
      {unit === "imperial" && (
        <div className="flex gap-1.5 mt-1.5">
          {[
            { key: false, label: "decimal (12.50 ft)" },
            { key: true, label: `fraction (${formatFeetInchesFraction(150.5)})` },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              onClick={() => setImperialFraction(opt.key)}
              className="flex-1 px-2 py-1 rounded text-[10px] border"
              style={imperialFraction === opt.key ? { borderColor: "#B8863E", color: "#B8863E" } : { borderColor: "#D8CCB0", color: "#8A97A3" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
