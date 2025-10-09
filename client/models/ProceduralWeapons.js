import * as THREE from 'three';

// Helper to create a standard material
const createMaterial = (color) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.6,
  metalness: 0.8,
});

// Define materials for reuse
const materials = {
  body: createMaterial(0x2d2d2d),
  grip: createMaterial(0x1a1a1a),
  magazine: createMaterial(0x3c3c3c),
  sight: createMaterial(0x111111),
  suppressor: createMaterial(0x252525),
  trigger: createMaterial(0x151515),
};

/**
 * Creates the Classic pistol model
 * @returns {THREE.Group}
 */
export function createClassic() {
  const group = new THREE.Group();

  // Slide
  const slide = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.25), materials.body);
  slide.position.set(0, 0.1, 0);
  group.add(slide);

  // Lower frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.25), materials.body);
  frame.position.set(-0.05, -0.2, 0);
  group.add(frame);

  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.25), materials.grip);
  grip.position.set(-0.2, -0.7, 0);
  grip.rotation.z = 0.15;
  group.add(grip);

  // Trigger
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), materials.trigger);
  trigger.position.set(0.2, -0.35, 0);
  group.add(trigger);

  // Trigger guard
  const triggerGuardShape = new THREE.Shape();
  triggerGuardShape.moveTo(0, 0);
  triggerGuardShape.absarc(0.1, 0.1, 0.2, Math.PI, 0, true);
  triggerGuardShape.lineTo(0.3, 0);
  const triggerGuardGeometry = new THREE.ExtrudeGeometry(triggerGuardShape, { depth: 0.05, bevelEnabled: false });
  const triggerGuard = new THREE.Mesh(triggerGuardGeometry, materials.body);
  triggerGuard.position.set(0.05, -0.5, -0.025);
  group.add(triggerGuard);

  // Rear sight
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.05), materials.sight);
  rearSight.position.set(-0.4, 0.35, 0);
  group.add(rearSight);

  return group;
}

/**
 * Creates the Ghost pistol model
 * @returns {THREE.Group}
 */
export function createGhost() {
  const group = new THREE.Group();

  // Main Body/Slide
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.25), materials.body);
  body.position.set(0, 0, 0);
  group.add(body);

  // Suppressor
  const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12), materials.suppressor);
  suppressor.rotation.z = Math.PI / 2;
  suppressor.position.set(0.9, -0.05, 0);
  group.add(suppressor);

  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.2, 0.25), materials.grip);
  grip.position.set(-0.3, -0.6, 0);
  grip.rotation.z = 0.1;
  group.add(grip);

  // Sight
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.1), materials.sight);
  sight.position.set(-0.5, 0.35, 0);
  group.add(sight);

  return group;
}

/**
 * Creates the Vandal rifle model
 * @returns {THREE.Group}
 */
export function createVandal(skinName = 'Default') {
    const group = new THREE.Group();

    // Select materials based on skin
    const bodyMaterial = skinName === 'Reaver Vandal (Purple)'
        ? createMaterial(0x4a0d6d)
        : materials.body;

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(3, 0.7, 0.5), bodyMaterial);
    receiver.position.set(0, 0, 0);
    group.add(receiver);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 8), bodyMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(2.4, 0.1, 0);
    group.add(barrel);

    // Handguard
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.45), bodyMaterial);
    handguard.position.set(1.2, 0, 0);
    group.add(handguard);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), materials.grip);
    grip.position.set(-0.8, -0.7, 0);
    grip.rotation.z = 0.25;
    group.add(grip);

    // Magazine
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), materials.magazine);
    magazine.position.set(0.2, -0.9, 0);
    magazine.rotation.z = -0.05;
    group.add(magazine);

    // Stock
    const stockBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.15), bodyMaterial);
    stockBar.position.set(-2.2, 0.1, 0);
    group.add(stockBar);
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.4), bodyMaterial);
    stockPad.position.set(-2.9, -0.1, 0);
    group.add(stockPad);

    // Optic
    const opticBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.35), materials.sight);
    opticBody.position.set(-0.2, 0.6, 0);
    group.add(opticBody);
    const opticLens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), createMaterial(0x55aaff));
    opticLens.rotation.x = Math.PI / 2;
    opticLens.position.set(0.2, 0.6, 0);
    group.add(opticLens);

    return group;
}

/**
 * Creates the Phantom rifle model
 * @returns {THREE.Group}
 */
export function createPhantom() {
    const group = new THREE.Group();

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.55), materials.body);
    receiver.position.set(0, 0, 0);
    group.add(receiver);

    // Integrated Suppressor / Handguard
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.0, 16), materials.suppressor);
    suppressor.rotation.z = Math.PI / 2;
    suppressor.position.set(1.5, 0, 0);
    group.add(suppressor);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.45), materials.grip);
    grip.position.set(-0.6, -0.7, 0);
    grip.rotation.z = 0.15;
    group.add(grip);

    // Magazine
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.45), materials.magazine);
    magazine.position.set(0.5, -1.0, 0);
    magazine.rotation.z = -0.1;
    group.add(magazine);

    // Top Rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.2), materials.sight);
    rail.position.set(-0.5, 0.4, 0);
    group.add(rail);

    // Red Dot Sight
    const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), materials.sight);
    sightBase.position.set(-0.5, 0.55, 0);
    group.add(sightBase);
    const sightLens = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.25), createMaterial(0xff5555));
    sightLens.position.set(-0.3, 0.7, 0);
    group.add(sightLens);


    return group;
}

/**
 * Creates a generic knife model
 * @returns {THREE.Group}
 */
export function createKnife() {
  const group = new THREE.Group();

  // Blade
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.05), createMaterial(0xcccccc));
  blade.position.set(0.5, 0, 0);
  group.add(blade);

  // Guard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), materials.grip);
  guard.position.set(0, 0, 0);
  group.add(guard);

  // Handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), materials.grip);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(-0.25, 0, 0);
  group.add(handle);

  return group;
}