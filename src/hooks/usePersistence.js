import { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "../lib/storage";
import { compressImageForStorage } from "../lib/imageCompression";

// Autosaves the floor plan to persistent storage ~900ms after the last change,
// downscaling the traced photo first (storage has a size cap). If the plan is
// still too big even compressed, it saves the geometry without the photo rather
// than failing outright. Loads whatever was last saved on mount.
export function usePersistence({ state, setters, nextIdRef }) {
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | saved-no-image | error
  const saveTimerRef = useRef(null);
  const skipNextAutosaveRef = useRef(false); // true only right after a successful restore

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await storage.get("floorplan");
        if (cancelled || !result || !result.value) return;
        const payload = JSON.parse(result.value);
        if (payload.image) setters.setImage(payload.image);
        setters.setScale(payload.scale ?? null);
        setters.setCalibrationLine(payload.calibrationLine ?? null);
        setters.setVertices(payload.vertices || []);
        setters.setRooms(payload.rooms || []);
        setters.setVoids(payload.voids || []);
        setters.setDoors(payload.doors || []);
        setters.setWindows(payload.windows || []);
        setters.setWallProps(payload.wallProps || {});
        setters.setFurniture(payload.furniture || []);
        setters.setUnit(payload.unit || "metric");
        setters.setImperialFraction(payload.imperialFraction ?? true);
        setters.setNorthAngle(payload.northAngle || 0);
        setters.setShowInteriorArea(payload.showInteriorArea ?? true);
        setters.setAngleSnap(payload.angleSnap ?? true);

        const allIds = [
          ...(payload.vertices || []).map((v) => v.id),
          ...(payload.rooms || []).map((r) => r.id),
          ...(payload.voids || []).map((v) => v.id),
          ...(payload.doors || []).map((d) => d.id),
          ...(payload.windows || []).map((w) => w.id),
          ...(payload.furniture || []).map((f) => f.id),
        ];
        nextIdRef.current = allIds.length ? Math.max(...allIds) + 1 : 1;
        if (!payload.image) setSaveStatus("saved-no-image");
        skipNextAutosaveRef.current = true;
      } catch {
        // nothing saved yet, or storage unavailable — start fresh
      } finally {
        setLoadedFromStorage(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToStorage = useCallback(async () => {
    if (!state.image) return;
    setSaveStatus("saving");
    try {
      const compressed = await compressImageForStorage(state.image.src, state.image.w, state.image.h);
      const f = compressed.factor;
      const scaleVertex = (v) => ({ ...v, x: v.x * f, y: v.y * f });
      const payload = {
        image: { src: compressed.src, w: compressed.w, h: compressed.h },
        scale: state.scale ? state.scale / f : null,
        calibrationLine: state.calibrationLine
          ? { p1: scaleVertex(state.calibrationLine.p1), p2: scaleVertex(state.calibrationLine.p2), inches: state.calibrationLine.inches }
          : null,
        vertices: state.vertices.map(scaleVertex),
        rooms: state.rooms,
        voids: state.voids,
        doors: state.doors,
        windows: state.windows,
        wallProps: state.wallProps,
        furniture: state.furniture.map((it) => ({ ...it, x: it.x * f, y: it.y * f })),
        unit: state.unit,
        imperialFraction: state.imperialFraction,
        northAngle: state.northAngle,
        showInteriorArea: state.showInteriorArea,
        angleSnap: state.angleSnap,
      };
      let json = JSON.stringify(payload);
      if (json.length > 4.7 * 1024 * 1024) {
        payload.image = null;
        json = JSON.stringify(payload);
        setSaveStatus("saved-no-image");
      } else {
        setSaveStatus("saved");
      }
      await storage.set("floorplan", json);
    } catch {
      setSaveStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!loadedFromStorage || !state.image) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToStorage();
    }, 900);
    return () => clearTimeout(saveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedFromStorage, state]);

  const clearSavedPlan = useCallback(async () => {
    try {
      await storage.delete("floorplan");
    } catch {
      /* ignore */
    }
    setSaveStatus("idle");
  }, []);

  return { loadedFromStorage, saveStatus, clearSavedPlan };
}
