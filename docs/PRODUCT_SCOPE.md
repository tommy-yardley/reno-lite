# Product scope

## Core promise

RenoLite turns measurements into a clear, contractor-shareable single-floor plan,
then lets a homeowner explore renovation layouts and service concepts on top of
verified geometry.

## Product rules

- Metric and common UK sizes are the default.
- Dimensions entered by the user are authoritative.
- Estate-agent and AI-generated plans are untrusted visual references only.
- Wall angles snap to 15° increments by default; exact dimensions remain editable.
- Locked geometry cannot be moved indirectly through a connected node.
- Rooms and voids are derived from the wall graph, then given user metadata.
- Architecture, furniture, electrical, plumbing, dimensions, and annotations remain
  separate disciplines with visibility and lock controls.
- Electrical and plumbing layouts are design concepts for professional review, not
  installation instructions or compliance certification.
- Exports omit reference images and preserve the same geometry visible in the editor.
- The product is local-first and must remain useful without an account or network.

## Explicitly out of scope

- Multi-floor projects and stairs.
- Calibrating or tracing a plan image as if it were reliable geometry.
- Free-angle sketching as the primary wall workflow.
- Structural, electrical, plumbing, or building-regulation approval.
- Automatic scraping of retailer pages.

## Near-term quality bar

A new user should be able to draw and dimension a room, add and resize openings,
place standard furniture, create a service concept, and export a legible contractor
pack without reading documentation or scrolling away from the canvas to find the
selected-object controls.
