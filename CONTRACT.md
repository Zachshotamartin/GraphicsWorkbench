# Graphics Experiments integration contract

Each tool is a separate repository/package. Portfolio and standalone pages import the same `src/index.js`; no duplicated tool logic. Shared runtime is `@zachshotamartin/graphics-workbench` in sibling GraphicsWorkbench, built by root. No GitHub Actions in any mini project. Root handles repository creation/PR/merge after verification. Do not commit/push unless root asks.

Export `metadata` with `{ id, title, description, controls: optional string, limitations: string[], technique: string, instructions: string[] }`, and named `createExperiment(ctx)` (sync). Also export pure geometry/simulation logic from separate src files for meaningful Node tests.

ctx:
- THREE (three 0.180); scene; camera PerspectiveCamera; renderer WebGLRenderer; canvas; controls OrbitControls; root THREE.Group for experiment-owned objects.
- ui.button(label, callback, {primary=false}={}) returns button.
- ui.range(label, {min,max,step=1,value,onChange}) returns input; onChange(number).
- ui.select(label, options, value, onChange) returns select; options array strings or {label,value}.
- ui.toggle(label, value, onChange) returns input.
- ui.file(label, onFile, {accept='.obj'}={}) returns input; onFile(file) can be async.
- ui.note(text) returns paragraph; ui.section(title) appends heading.
- setStatus(text) updates polite live status + marks render dirty. Use status for actual counts/results, no invented metrics.
- listen(target, type, handler, options) auto-cleaned listener.
- onFrame((dt, elapsed)=>{}) returns unsubscribe. dt in seconds capped1/30. Not called when document hidden or offscreen. If sim playing call invalidate each update.
- invalidate() renders changed scene.
- fit(object=root) updates camera framing.
- pointer(event) => THREE.Vector2 NDC relative canvas; pick(event, objects=root.children) => Raycaster intersections recursively.
- download(filename, textOrBlob, mime='text/plain'); exportOBJ(object=root, filename='model.obj').
- reducedMotion boolean; palette={ body:0xb8cd99, accent:0xd99976, dark:0x20382e, metal:0xa6bab2, cream:0xe7ece1 }.
Runtime creates neutral green background, lights, controls, resize/visibility cleanup, PNG snapshot and Reset view. Canvas has touch-action:none confined to canvas, page scroll elsewhere.

Return { dispose() optional }. Dispose custom CPU resources/listeners not registered via ctx; runtime disposes scene geometries/materials and own listeners/renderloop. Use THREE imports directly only in pure logic if desired; `three` peerDependency. Algorithms must be real and testable: no canned-only outputs. Each tool needs preset examples, meaningful edits, reset/undo where relevant, and useful exports. Pick all user-interactable labels clearly. Limit scope honestly in metadata and README; do not claim full Blender or CAD implementation. Canvas picking and meaningful button alternatives should both work on mobile.

Package scripts: test `node --test tests/*.test.js`, dev `vite --host 127.0.0.1`, build `vite build`.
Standalone main imports mountLab from runtime and createExperiment locally; root supplies scaffold.
Agents own only their assigned project dirs, plus NOTES.md per repo with test/sample instructions. Do not edit portfolio/runtime shared files.
