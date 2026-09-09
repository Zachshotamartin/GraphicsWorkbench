import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { finiteBounds, framingDistance, resizeDistance } from '../src/framing.js';

test('resizing fits all corners while retaining orbit, target, and relative zoom', () => {
  const mesh = new Mesh(new BoxGeometry(6, 3, 2)), box = finiteBounds(mesh);
  const target = new Vector3(.2, .1, 0), direction = new Vector3(-.8, .5, 1).normalize();
  const camera = new PerspectiveCamera(38, 1.7, .01, 1000);
  const oldFit = framingDistance(box, target, direction, camera.up, camera.fov, camera.aspect);
  const position = target.clone().addScaledVector(direction, oldFit * 1.3);
  const moved = resizeDistance(box, target, position, camera.up, camera.fov, 1.7, .87);
  const newFit = framingDistance(box, target, direction, camera.up, camera.fov, .87);
  assert.ok(Math.abs(moved.distance / newFit - 1.3) < 1e-10);
  assert.ok(moved.direction.distanceTo(direction) < 1e-10);
  camera.aspect = .87; camera.position.copy(target).addScaledVector(moved.direction, moved.distance);
  camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new Vector3(x, y, z).project(camera);
    assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1);
  }
  const back = resizeDistance(box, target, camera.position, camera.up, camera.fov, .87, 1.7);
  assert.ok(Math.abs(back.distance - oldFit * 1.3) < 1e-10);
});

test('invalid coordinates and transforms are rejected; an empty scene is harmless', () => {
  assert.equal(finiteBounds(new Group()), null);
  for (const value of [NaN, Infinity, -Infinity]) {
    const mesh = new Mesh(new BoxGeometry()); mesh.geometry.attributes.position.setX(0, value);
    assert.throws(() => finiteBounds(mesh), /non-finite coordinates/);
  }
  const mesh = new Mesh(new BoxGeometry()); mesh.position.x = Infinity;
  assert.throws(() => finiteBounds(mesh), /non-finite transforms/);
});

test('bounds reflect actual vertex edits even when the cached box is stale', () => {
  const mesh = new Mesh(new BoxGeometry()); mesh.geometry.computeBoundingBox();
  mesh.geometry.attributes.position.setX(0, 5);
  assert.equal(finiteBounds(mesh).max.x, 5);
});

test('top-down cameras and intentionally zoomed-in views preserve a finite zoom ratio', () => {
  const box = finiteBounds(new Mesh(new BoxGeometry(2, 1, 3))), target = new Vector3(), up = new Vector3(0, 1, 0);
  const direction = new Vector3(0, 1, 0), oldFit = framingDistance(box, target, direction, up, 38, 2);
  const result = resizeDistance(box, target, direction.clone().multiplyScalar(oldFit * .7), up, 38, 2, .5);
  const newFit = framingDistance(box, target, direction, up, 38, .5);
  assert.ok(Number.isFinite(result.distance)); assert.ok(Math.abs(result.distance / newFit - .7) < 1e-10);
});
