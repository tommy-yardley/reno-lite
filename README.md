# RenoLite

RenoLite is a local-first, CAD-style renovation planner for measured, single-floor
plans. It is metric-first and oriented around common UK building, furniture,
electrical, and plumbing conventions.

Agent and estate-agent floor plans are treated as untrusted visual references. They
appear beside the drawing and never define its scale or geometry.

## What it does

- Draws an explicit node-and-wall graph in real-world units with 15° snapping.
- Supports exact wall lengths and thicknesses, locked geometry, junctions, and
  parametric doors and windows.
- Names enclosed spaces as rooms or voids and reports gross, excluded, and net area.
- Places UK-sized furniture, electrical devices, plumbing fixtures, and service
  routes on independently visible and lockable layers.
- Checks furniture layout, door clearances, and out-of-room placement.
- Maintains a GBP procurement schedule for products and materials.
- Saves editable project files and exports clean SVG, PNG, PDF, tiled true-scale
  PDF, DXF, and shopping-list CSV/PDF output.
- Runs entirely on the device with browser-local autosave and no external API.

RenoLite is intentionally a single-floor 2D planning tool. Multi-floor plans,
stairs, image calibration, and treating a reference image as drawing geometry are
outside the product scope.

## Development

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run check
```

The production build is emitted to `dist/`:

```bash
npm run build
npm run preview
```

For Capacitor development and Android artifact builds, see [MOBILE.md](./MOBILE.md).

## Architecture

The active application lives in `src/cad/`. `src/App.jsx` composes the workspace,
and reusable platform/export helpers live in `src/lib/`. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for dependency rules and
[docs/PRODUCT_SCOPE.md](./docs/PRODUCT_SCOPE.md) for product decisions.

Projects autosave to the current browser/device and can be kept as named entries in
the local project library. Editable `.renolite` files remain the portable backup
and transfer format.

## Continuous integration

Every pull request runs the Node suite, a real headless-browser interaction and
accessibility smoke test, and the production build. The Android
workflow builds an installable debug APK on demand and for version tags; tagged
builds are attached to a GitHub release.
