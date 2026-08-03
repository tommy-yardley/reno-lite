import { useState, useCallback, useEffect } from "react";

// Generic undo/redo: the caller supplies how to snapshot the current state and
// how to re-apply a snapshot. The hook itself has no idea it's tracking a floor
// plan — that decoupling is what makes it reusable elsewhere if needed.
export function useHistory({ getSnapshot, applySnapshot, limit = 50 }) {
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-(limit - 1)), getSnapshot()]);
    setFuture([]);
  }, [getSnapshot, limit]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [getSnapshot(), ...f].slice(0, limit));
    setHistory((h) => h.slice(0, -1));
    applySnapshot(prev);
  }, [history, getSnapshot, applySnapshot, limit]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h.slice(-(limit - 1)), getSnapshot()]);
    setFuture((f) => f.slice(1));
    applySnapshot(next);
  }, [future, getSnapshot, applySnapshot, limit]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setFuture([]);
  }, []);

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo.
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return {
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    pushHistory,
    undo,
    redo,
    clearHistory,
  };
}
