# RenoLite

A browser-based, CAD-first renovation planner for drawing a measured floor plan and
using agent-produced plans as a separate visual reference.

> The default editor is now the v2 CAD foundation. The previous tracing editor is
> retained in `src/components` and `src/hooks/useFloorplanState.js` while rooms,
> openings, furniture and exports are migrated onto the new explicit wall graph.

Draw walls in real-world units → enter exact dimensions → lock verified geometry →
keep the agent plan beside the canvas as a visual reference.

## Features

**CAD foundation (default editor)**
- Explicit node-and-wall graph stored in real-world units rather than image pixels.
- A separate reference panel; uploading or replacing an agent plan never changes
  the drawing, scale, or geometry.
- Wall chains snap at 15° increments and can branch from existing wall endpoints or
  from a newly-created anchor in the middle of a wall.
- Exact wall length and thickness editing in metric or imperial units.
- Wall locking protects both endpoints from direct or connected edits.
- Anchors only appear while drawing or when their wall is selected.
- Local persistence plus undo/redo.

## Legacy implementation retained for migration

The codebase still contains the following v1 features. They are not exposed by the
default v2 editor until each is migrated onto the explicit wall graph.

**Floor plan tracing (v1)**
- Upload a photo, draw a reference line over a wall of known length, and everything
  else is measured against that scale.
- Rooms are drawn by clicking corners; snapping onto an existing corner creates a
  wall *shared* between two rooms, so dragging it moves both rooms at once.
- 45°/90° angle snapping while tracing (toggleable), numeric wall-length editing,
  drag-to-adjust corners, and a "delete this corner" action that straightens every
  room/void it touches.
- Blocked-in / non-livable spaces (chimney breasts, columns, chases) subtract from
  whichever room contains them.
- Wall thickness (per-wall or batch "set all exterior/interior walls to X"), and an
  "open boundary" flag for edges that aren't a real wall.
- Room-overlap and void-escaped-its-room validation.

**Doors & windows**
- Click-to-place on any wall, drag along the wall, custom widths with quick presets.
- Doors: flip hinge, mirror swing direction.
- Both reclamp automatically if the wall they're on gets shortened.

**Furniture**
- Per-room-type preset catalog (bed, sofa, desk, etc.) plus fully custom items.
- Custom width/depth/height, category, a "buy this" link field, and an avoid-windows
  toggle (auto-suggested from height once you set one — no external lookups, this
  is all local math against a typical sill-height threshold).
- Drag freely; dropping a piece into a different room reassigns it there.
- Rule-based **auto-arrange** per room — anchors the primary piece to its longest
  wall, fills the rest around doors/windows, respects avoid-windows.
- Collision / door-clearance / outside-its-room warnings.
- A combined shopping-list view across every room.

**Export**
- PNG / SVG / PDF snapshots for quick sharing.
- DXF with real wall/door/window/furniture vector geometry for reopening in CAD software.
- **True-to-scale PDF printing**: pick a paper size and a real architectural/metric
  scale (e.g. 1/4"=1'-0" or 1:50); if the plan is bigger than one sheet at that
  scale, it's automatically tiled across multiple pages with an overlap margin and
  a sheet reference label (A1, A2, B1…) so they can be trimmed and taped together.
  Print at 100%/actual size, not "fit to page."

**Other**
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z), Escape cancels whatever mode you're in.
- Imperial (decimal or feet-inch-fraction) or metric units (metric by default), a
  live scale bar, and a click-to-rotate north arrow.
- Autosaves to the browser's local storage (see **Persistence** below).

## Tech stack

- [Vite](https://vitejs.dev/) + React (no other framework)
- Plain CSS via [Tailwind](https://tailwindcss.com/) utility classes
- [lucide-react](https://lucide.dev/) for icons
- No backend, no external API calls — everything runs client-side, including every
  export format

## Getting started

```bash
npm install
npm run dev
```

Vite will print a local URL (`http://localhost:5173`) and, since the dev server is
configured to listen on your network, a second URL like `http://192.168.x.x:5173`.

### Testing on your phone

1. Make sure your phone and the computer running `npm run dev` are on the **same
   Wi-Fi network**.
2. Run `npm run dev` and look for the `Network:` URL in the terminal output.
3. Open that URL in your phone's browser.

This runs the app as a normal top-level webpage (not embedded in any preview frame),
so things like the file upload button, touch dragging, and the file-download-based
exports should all behave like a real site.

### Building for production

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally to sanity-check it
```

`dist/` is a static site — you can host it anywhere that serves static files
(GitHub Pages, Netlify, Vercel, S3, etc.). There's no server-side code at all.

### Building it as a native phone app

See [MOBILE.md](./MOBILE.md) — the project is already scaffolded for
[Capacitor](https://capacitorjs.com/) (iOS/Android), which wraps this same web app in
a native shell. Exports and photo capture already detect native vs. web at runtime
and use the right APIs for each (native share sheet / camera on iOS-Android, plain
browser download/file-input on the web) — see `src/lib/nativeExport.js` and
`src/lib/nativeCamera.js`.

## Persistence

The app autosaves to the browser's `localStorage` about a second after you stop
editing. A few things worth knowing:

- It's **per-browser, per-device** — there's no account system or syncing. Testing
  in Chrome and Safari on the same phone will show two different saved plans.
- The traced photo gets downscaled before saving (to stay well under browser storage
  limits). If it's still too large, the app saves your geometry without the photo
  rather than failing — you'll see a note in the header if that happens.
- `src/lib/storage.js` is a thin wrapper around `localStorage`. If you want to add a
  real backend later (so plans sync across devices), that's the only file that
  should need to change — nothing else in the app talks to storage directly.

## Project structure

```
reno-lite/
├── index.html
├── package.json
├── vite.config.js
├── capacitor.config.json
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx                    # React entry point
│   ├── index.css                   # Tailwind directives
│   ├── App.jsx                     # thin orchestrator — wires the state hook to layout
│   ├── constants/
│   │   └── index.js                # palette, defaults, room types — one source of truth
│   ├── hooks/
│   │   ├── useFloorplanState.js    # all app state, derived values, and actions
│   │   ├── useHistory.js           # generic undo/redo (doesn't know what it's tracking)
│   │   └── usePersistence.js       # load/autosave/clear, decoupled from storage backend
│   ├── lib/                        # pure logic — no React, easiest part to unit-test
│   │   ├── geometry.js             # polygon/vector math shared by everything else
│   │   ├── units.js                # imperial/metric conversion & formatting
│   │   ├── furnitureEngine.js      # furniture presets + rule-based auto-arrange
│   │   ├── dxfExport.js
│   │   ├── pdfExport.js            # snapshot PDF + true-to-scale tiled print PDF
│   │   ├── imageCompression.js
│   │   ├── storage.js              # localStorage wrapper
│   │   ├── nativeExport.js         # native share sheet vs. browser download
│   │   └── nativeCamera.js         # native camera capture vs. no-op on web
│   └── components/
│       ├── Header.jsx
│       ├── Sidebar.jsx              # composes all the panels below, in order
│       ├── panels/                  # one file per sidebar section
│       │   ├── UploadUnitsPanel.jsx
│       │   ├── CalibrationPanel.jsx
│       │   ├── TracePanel.jsx
│       │   ├── WallPanel.jsx        # selected wall, batch thickness, corner deletion
│       │   ├── RoomsPanel.jsx
│       │   ├── VoidsPanel.jsx
│       │   ├── WindowsPanel.jsx
│       │   ├── DoorsPanel.jsx
│       │   ├── FurniturePanel.jsx
│       │   ├── ShoppingListPanel.jsx
│       │   └── ExportPanel.jsx
│       └── canvas/
│           └── FloorplanCanvas.jsx  # the SVG — all rendering layers in one file
```

Every panel and the canvas receive one prop (`fp`, the object returned by
`useFloorplanState`) rather than a long list of individual props. That's a deliberate
tradeoff: simpler call sites everywhere, at the cost of each component technically
having access to more than it strictly needs. Worth revisiting with React Context if
the prop surface keeps growing, but at the current depth (state hook → two direct
children → panels) it isn't a real prop-drilling problem yet.

## Known limitations

- **Never tested in a real browser.** Everything up to this point was built and
  verified through code review, cross-file import/export checks, and isolated logic
  tests (Node scripts checking the math), not by actually opening the app. Please
  report anything broken — dragging, the file picker, exports, all of it is a real
  unknown until it's run for real.
- No multi-floor support, stairs, electrical/plumbing symbols, or door/window type
  variety (sliding, French, bay) — this is a single-floor 2D plan tool.
- Interior (wall-thickness-adjusted) room area is an approximation — it insets by
  half the wall thickness per edge but doesn't miter corners exactly.
- Print tiling uses a fixed overlap margin; very oddly-proportioned plans (a long
  thin hallway wing, say) may need more sheets than a hand-optimized layout would.
- No furniture height auto-detection from a product link. This was considered and
  deliberately not built — reliable scraping isn't possible from a browser (CORS),
  and routing it through an LLM adds cost/latency for something the manual
  height-with-suggested-toggle covers well enough.
