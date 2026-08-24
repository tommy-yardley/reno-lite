# Architecture

## Boundaries

`src/App.jsx` is the composition root. The editor implementation is split into:

- `src/cad/`: floor-plan domain logic, editor state, panels, canvas, and exports.
- `src/lib/`: platform adapters and small shared utilities.
- `src/main.jsx` and `src/index.css`: application bootstrap and global styling.

There is one editor implementation. Do not add a second canvas, state hook, or
parallel model for a feature migration. Extend the CAD model and its commands.

## Dependency direction

Pure domain modules must not import React or browser APIs. React components may
depend on domain modules; domain modules must not depend on components. Browser and
Capacitor integrations belong behind adapters in `src/lib/`.

The drawing canvas and every export should consume the same render description.
Adding a plan object must therefore update one renderer rather than duplicate SVG,
PNG, PDF, and DXF interpretation in UI code.

## State changes

User-visible edits should be expressed as commands with a single apply path. The
same command boundary owns validation, undo/redo metadata, and dirty-state changes.
Transient pointer and viewport state must remain outside the persisted project.

## Project data

Persisted projects require:

- a top-level schema version;
- stable IDs and explicit references;
- migration from every supported previous version;
- validation before replacing the open project;
- deterministic serialisation suitable for fixtures and regression tests.

All geometry is stored in real-world metres. Unit preferences affect display and
input only.

## Verification

`npm run check` is the minimum local and CI gate. Pure geometry, catalogue, service,
shopping, schema, migration, command, and rendering behaviour belongs in Node tests.
Browser interaction coverage is added separately for pointer, touch, accessibility,
storage, import, and export flows.
