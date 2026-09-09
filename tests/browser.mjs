import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), cacheDir: '.vite', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/tests/fixture.html`;
let browser, disabled;
try {
  browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.waitForFunction(() => window.mountExample);
  await page.evaluate(() => window.mountExample());
  await expect(page.getByRole('slider', { name: 'Example radius', exact: true })).toHaveValue('3');
  await expect.poll(() => page.evaluate(() => window.renderCount)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => window.lab.ctx.camera.aspect)).toBeLessThan(1);
  const fit = await page.evaluate(() => {
    const { ctx } = window.lab; ctx.camera.updateMatrixWorld();
    const b = new ctx.THREE.Box3().setFromObject(ctx.root), points = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) points.push(new ctx.THREE.Vector3(x, y, z).project(ctx.camera));
    return Math.max(...points.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
  });
  assert.ok(fit <= 1, `Geometry clipped at projected coordinate ${fit}`);
  const invalid = await page.evaluate(() => {
    const { ctx } = window.lab, before = ctx.camera.position.toArray();
    const position = window.fixtureMesh.geometry.attributes.position, original = position.getX(0); position.setX(0, NaN);
    let message; try { ctx.fit(); } catch (error) { message = error.message; }
    position.setX(0, original);
    return { before, after: ctx.camera.position.toArray(), message };
  });
  assert.deepEqual(invalid.before, invalid.after); assert.match(invalid.message, /non-finite/);
  await page.evaluate(() => { window.loss = window.lab.ctx.renderer.getContext().getExtension('WEBGL_lose_context'); window.loss.loseContext(); });
  await expect(page.getByRole('status')).toContainText('Graphics paused');
  await page.evaluate(() => { window.renderCount = 0; window.loss.restoreContext(); });
  await expect(page.getByRole('status')).toHaveText('Ready');
  await expect.poll(() => page.evaluate(() => window.renderCount)).toBeGreaterThan(0);
  const disposal = await page.evaluate(() => {
    const disposed = { geometry: 0, material: 0 }; const mesh = window.fixtureMesh;
    mesh.geometry.addEventListener('dispose', () => disposed.geometry++); mesh.material.addEventListener('dispose', () => disposed.material++);
    window.lab.dispose(); return { ...disposed, empty: !document.querySelector('#host').childElementCount };
  });
  assert.deepEqual(disposal, { geometry: 1, material: 1, empty: true }); assert.deepEqual(errors, []);
  disabled = await chromium.launch({ channel: 'chromium', args: ['--disable-webgl'] });
  const failed = await disabled.newPage(); await failed.goto(url); await failed.waitForFunction(() => window.mountExample);
  const failure = await failed.evaluate(() => { let message; try { window.mountExample(); } catch (error) { message = error.message; } return { message, remaining: document.querySelector('#host').childElementCount }; });
  assert.match(failure.message, /WebGL/); assert.equal(failure.remaining, 0);
  console.log('Browser regressions passed: responsive fit, accessible slider, invalid bounds, context restoration, disposal, and WebGL-unavailable startup.');
} finally {
  await browser?.close(); await disabled?.close(); await server.close();
}
