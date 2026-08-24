import React, { useEffect, useRef, useState } from "react";
import { Copy, FolderOpen, Save, Trash2, X } from "lucide-react";
import {
  deleteProjectFromLibrary,
  duplicateProjectInLibrary,
  listProjects,
  saveProjectToLibrary,
} from "./projectStore";

export default function ProjectLibrary({ cad, onClose }) {
  const [projects, setProjects] = useState(() => listProjects());
  const [notice, setNotice] = useState("");
  const closeRef = useRef(null);
  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const saveCurrent = () => {
    try {
      const result = saveProjectToLibrary(cad.project);
      cad.setProjectId(result.project.projectId);
      setNotice(
        result.referenceOmitted
          ? "Project saved; the large reference image was omitted from the library copy."
          : "Project saved to this device.",
      );
      refresh();
    } catch {
      setNotice("This browser could not save another project. Export a project file before clearing storage.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1B2B3A]/45 p-2 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="project-library-title">
      <div className="flex max-h-[min(760px,92dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#D8CCB0] bg-[#F3EEE3] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-[#D8CCB0] bg-[#FBF8F1] px-4 py-3">
          <FolderOpen size={18} color="#B8863E" />
          <div className="min-w-0 flex-1">
            <h2 id="project-library-title" className="text-sm font-semibold">Projects on this device</h2>
            <p className="text-[10px] text-[#8A97A3]">Local to this browser; export a project file for backup or transfer.</p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close project library" className="rounded p-2 text-[#5B6B78]"><X size={18} /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={saveCurrent} className="flex items-center justify-center gap-2 rounded-md bg-[#B8863E] px-3 py-2 text-xs font-medium text-white"><Save size={14} /> Save current</button>
            <button onClick={() => { if (window.confirm("Start a new empty project? Save or export the current one first.")) { cad.clearProject(); onClose(); } }} className="rounded-md border border-[#D8CCB0] bg-[#FBF8F1] px-3 py-2 text-xs text-[#5B6B78]">New project</button>
          </div>
          {notice && <p role="status" className="rounded border border-[#D8CCB0] bg-[#FBF8F1] p-2 text-[10px] text-[#5B6B78]">{notice}</p>}
          {projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#B9AB8B] bg-[#FBF8F1] p-6 text-center">
              <p className="text-sm font-medium">No saved projects yet</p>
              <p className="mt-1 text-[10px] text-[#8A97A3]">The current drawing still autosaves; add it here to keep named versions.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#D8CCB0] bg-[#FBF8F1]">
              {projects.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#E8DFC9] p-3 last:border-b-0">
                  <button onClick={() => { cad.loadProject(entry.project); onClose(); }} className="min-w-0 text-left">
                    <strong className="block truncate text-sm text-[#1B2B3A]">{entry.name}</strong>
                    <span className="mono text-[9px] text-[#8A97A3]">{entry.project.walls.length} walls · {entry.project.rooms.length} rooms · {new Date(entry.updatedAt).toLocaleString()}</span>
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => { duplicateProjectInLibrary(entry.project); refresh(); }} aria-label={`Duplicate ${entry.name}`} title="Duplicate" className="rounded p-2 text-[#5E86A8]"><Copy size={14} /></button>
                    <button onClick={() => { if (window.confirm(`Delete "${entry.name}" from this device?`)) { deleteProjectFromLibrary(entry.id); refresh(); } }} aria-label={`Delete ${entry.name}`} title="Delete" className="rounded p-2 text-[#B2483A]"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
