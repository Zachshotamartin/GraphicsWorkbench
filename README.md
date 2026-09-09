# GraphicsWorkbench

Shared browser viewer for Zach Martin's graphics experiments. Each tool owns its geometry and simulation logic in a separate repository; this package supplies the consistent interaction shell.

```js
import { mountLab } from '@zachshotamartin/graphics-workbench';
import '@zachshotamartin/graphics-workbench/style.css';
import { createExperiment } from '@zachshotamartin/mesh-workshop';
const lab = mountLab(document.querySelector('#lab'), createExperiment);
// On navigation or unmount:
lab.dispose();
```

Three.js is a peer dependency. A single viewer owns one renderer, OrbitControls, resize and visibility observers, and a disposable context. The context provides labeled inputs, status announcements, camera fitting, ray picking, OBJ exports, and PNG captures. Scene work pauses while the viewer is offscreen or the document is hidden. Disposal cancels animation frames, removes listeners, releases geometries/materials/textures, and closes the WebGL context.

Canvas gestures are confined to the viewer; the surrounding page remains scrollable on mobile. WebGL is required for interactive previews. Tool implementations decide their own reduced-motion simulation defaults using `ctx.reducedMotion`.

Resizing retains the camera's orbit, pan, and zoom relative to a fitted view, while adapting the fit distance to the new aspect ratio. Invalid coordinates or transforms are rejected before changing the camera. Context loss pauses scene updates and displays a status message; restoration redraws the existing scene. If WebGL is unavailable at startup, mounting throws without leaving a partial viewer in the host.

## Local verification

```sh
npm install
npx playwright install chromium
npm test
npm run test:browser
```

The unit tests verify projected bounds, relative zoom and orbit preservation, invalid geometry, and stale cached bounds. The browser script starts an isolated Vite fixture and verifies responsive framing, accessible control labels, WebGL loss/restoration, GPU-resource disposal, and clean startup failure with WebGL disabled. The expected WebGL-disabled check logs the browser's context-creation error.

See `CONTRACT.md` for the full context API. This is shared infrastructure; it is not an additional portfolio experiment. No GitHub Actions are configured.
