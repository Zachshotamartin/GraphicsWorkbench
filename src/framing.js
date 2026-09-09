import { Box3, MathUtils, Vector3 } from 'three';

export function finiteBounds(object) {
  object.updateWorldMatrix(true, true);
  object.traverse(child => {
    if (!child.matrixWorld.elements.every(Number.isFinite)) throw new Error('Cannot frame geometry with non-finite transforms.');
    const position = child.geometry?.attributes.position;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite)) {
        throw new Error('Cannot frame geometry with non-finite coordinates.');
      }
    }
  });
  // Precise bounds also avoid stale cached geometry bounds after sculpting.
  const box = new Box3().setFromObject(object, true);
  if (box.isEmpty()) return null;
  if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw new Error('Cannot frame invalid geometry bounds.');
  return box;
}

export function framingDistance(box, target, direction, up, fov, aspect) {
  if (!(aspect > 0) || !Number.isFinite(aspect)) throw new Error('The viewport must have a finite aspect ratio.');
  const right = new Vector3().crossVectors(up, direction);
  if (right.lengthSq() < 1e-10) right.crossVectors(new Vector3(1, 0, 0), direction);
  right.normalize();
  const vertical = new Vector3().crossVectors(direction, right).normalize();
  const tanV = Math.tan(MathUtils.degToRad(fov / 2)), tanH = tanV * aspect;
  let distance = 1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new Vector3(x, y, z).sub(target), depth = v.dot(direction);
    distance = Math.max(distance, depth + Math.abs(v.dot(right)) / tanH, depth + Math.abs(v.dot(vertical)) / tanV);
  }
  if (!Number.isFinite(distance)) throw new Error('Cannot frame invalid geometry bounds.');
  return distance * 1.12;
}

export function resizeDistance(box, target, position, up, fov, oldAspect, newAspect) {
  const offset = position.clone().sub(target), direction = offset.clone().normalize();
  const oldFit = framingDistance(box, target, direction, up, fov, oldAspect);
  const newFit = framingDistance(box, target, direction, up, fov, newAspect);
  // Retain the user's orbit, pan, and zoom relative to a fitted view.
  return { direction, distance: offset.length() * newFit / oldFit };
}
