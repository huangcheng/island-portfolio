import * as THREE from 'three';

// ── Palette (panda) ────────────────────────────────────────────────────────
const FUR = 0xf7f2e8; // warm white
const BLACK = 0x2e2a2e; // ears / patches / limbs
const EYE = 0x1f1a1c; // near-black eyes
const HIGHLIGHT = 0xffffff;
const NOSE = 0x2a2428;
const BLUSH = 0xf5b0b0; // soft pink cheeks
const MOUTH = 0x4a3a35;

// ── Layout constants (group origin = feet at y=0) ──────────────────────────
const HIP_Y = 0.62;
const NECK_Y = 1.15;
const HEAD_CY = 0.57;
const HEAD_R = 0.62;

/**
 * Panda villager — huge white potato head, black teardrop eye patches,
 * round black ears, small dark eyes with highlights, pink blush, black
 * limbs + white belly, tiny tail stub. 100% three.js primitives.
 *
 * Animation: blended idle↔walk cycle (pendulum legs, lagging arms, torso
 * squash & stretch with the head counter-scaled rigid), random blinks,
 * idle ear twitch + tail wiggle.
 */
export class Villager {
  readonly group = new THREE.Group();

  private readonly bodyGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly tailGroup = new THREE.Group();
  private readonly leftArmPivot = new THREE.Group();
  private readonly rightArmPivot = new THREE.Group();
  private readonly leftLegPivot = new THREE.Group();
  private readonly rightLegPivot = new THREE.Group();
  private readonly eyeGroupL = new THREE.Group();
  private readonly eyeGroupR = new THREE.Group();
  private readonly earL = new THREE.Group();
  private readonly earR = new THREE.Group();

  private readonly matCache = new Map<number, THREE.MeshStandardMaterial>();

  /** Desired facing direction (radians, atan2 convention on XZ). */
  heading = Math.PI;
  /** Walk speed in world units / second. */
  speed = 4.4;

  private walkT = Math.random() * Math.PI * 2;
  private idleT = 0;
  private moveBlend = 0;
  private blinkTimer = 2 + Math.random() * 2.5;
  private blinkT = 1;
  private blinking = false;
  private readonly blinkDur = 0.16;

  constructor() {
    const mat = (c: number) => {
      let m = this.matCache.get(c);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 });
        this.matCache.set(c, m);
      }
      return m;
    };
    const ball = (
      parent: THREE.Object3D,
      color: number,
      pos: [number, number, number],
      r: number,
      scale: [number, number, number] = [1, 1, 1],
      cast = false,
    ) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat(color));
      m.position.set(pos[0], pos[1], pos[2]);
      m.scale.set(scale[0], scale[1], scale[2]);
      m.castShadow = cast;
      parent.add(m);
      return m;
    };

    // ── Legs + feet (black) — children of root ─────────────────────────────
    const legGeo = new THREE.CylinderGeometry(0.125, 0.115, 0.3, 14);
    legGeo.translate(0, -0.15, 0);
    for (const [pivot, sx] of [[this.leftLegPivot, -0.17], [this.rightLegPivot, 0.17]] as const) {
      pivot.position.set(sx, 0.5, 0);
      const leg = new THREE.Mesh(legGeo, mat(BLACK));
      leg.castShadow = true;
      pivot.add(leg);
      ball(pivot, BLACK, [0, -0.4, 0.04], 0.15, [1, 0.62, 1.25], true);
      this.group.add(pivot);
    }

    // ── Body (white belly egg), pivots at the hips ─────────────────────────
    this.bodyGroup.position.set(0, HIP_Y, 0);
    ball(this.bodyGroup, FUR, [0, 0.27, 0], 0.4, [1.0, 1.04, 0.92], true);

    // ── Arms (black, pivot at shoulder) ────────────────────────────────────
    const armGeo = new THREE.CapsuleGeometry(0.105, 0.3, 6, 12);
    armGeo.translate(0, -0.22, 0);
    for (const [pivot, sx, zRot] of [
      [this.leftArmPivot, -0.41, -0.14],
      [this.rightArmPivot, 0.41, 0.14],
    ] as const) {
      pivot.position.set(sx, 0.44, 0);
      pivot.rotation.z = zRot;
      const arm = new THREE.Mesh(armGeo, mat(BLACK));
      arm.castShadow = true;
      pivot.add(arm);
      ball(pivot, BLACK, [0, -0.46, 0], 0.12); // paw
      this.bodyGroup.add(pivot);
    }

    // ── Tiny tail stub (own pivot for wiggle) ──────────────────────────────
    this.tailGroup.position.set(0, 0.12, -0.34);
    ball(this.tailGroup, FUR, [0, 0.04, -0.02], 0.1, [1, 0.9, 0.8], true);
    this.bodyGroup.add(this.tailGroup);

    // ── Head (pivot at neck) — white potato ────────────────────────────────
    this.headGroup.position.set(0, NECK_Y - HIP_Y, 0);
    this.bodyGroup.add(this.headGroup);
    ball(this.headGroup, FUR, [0, HEAD_CY, 0], HEAD_R, [1.06, 1.0, 1.02], true);

    // ── Round black ears on twitch pivots ──────────────────────────────────
    for (const [grp, sx] of [[this.earL, -0.35], [this.earR, 0.35]] as const) {
      grp.position.set(sx, HEAD_CY + 0.5, -0.04);
      grp.rotation.z = sx < 0 ? 0.18 : -0.18;
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), mat(BLACK));
      ear.scale.set(1, 1, 0.6);
      ear.castShadow = true;
      grp.add(ear);
      this.headGroup.add(grp);
    }

    this.buildFace(mat);
    this.group.add(this.bodyGroup);
  }

  /** Panda face: black teardrop patches, small dark eyes, triangle nose, blush. */
  private buildFace(mat: (c: number) => THREE.MeshStandardMaterial) {
    const hg = this.headGroup;

    // Black teardrop eye patches (tilted slightly outward-down — panda charm)
    const patchGeo = new THREE.SphereGeometry(0.155, 18, 14);
    for (const sx of [-0.235, 0.235]) {
      const patch = new THREE.Mesh(patchGeo, mat(BLACK));
      patch.position.set(sx, HEAD_CY + 0.03, 0.55);
      patch.scale.set(0.78, 1.08, 0.38);
      patch.rotation.z = sx < 0 ? -0.18 : 0.18;
      hg.add(patch);
    }

    // Small dark eyes ON the patches, with a bright highlight each
    const eyeGeo = new THREE.SphereGeometry(0.062, 14, 12);
    const highlightGeo = new THREE.SphereGeometry(0.024, 10, 8);
    for (const [grp, sx] of [[this.eyeGroupL, -0.235], [this.eyeGroupR, 0.235]] as const) {
      grp.position.set(sx, HEAD_CY + 0.045, 0.615); // proud of the patch
      const eye = new THREE.Mesh(eyeGeo, mat(EYE));
      eye.scale.set(0.9, 1.1, 0.42);
      grp.add(eye);
      const hi = new THREE.Mesh(highlightGeo, mat(HIGHLIGHT));
      hi.position.set(sx < 0 ? 0.02 : -0.02, 0.026, 0.035);
      grp.add(hi);
      hg.add(grp);
    }

    // Black rounded-triangle nose
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, -0.055);
    noseShape.quadraticCurveTo(0.055, -0.012, 0.05, 0.024);
    noseShape.quadraticCurveTo(0.05, 0.036, 0.02, 0.036);
    noseShape.lineTo(-0.02, 0.036);
    noseShape.quadraticCurveTo(-0.05, 0.036, -0.05, 0.024);
    noseShape.quadraticCurveTo(-0.055, -0.012, 0, -0.055);
    const nose = new THREE.Mesh(new THREE.ShapeGeometry(noseShape), mat(NOSE));
    nose.position.set(0, HEAD_CY - 0.13, 0.635);
    hg.add(nose);

    // Gentle little smile under the nose
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI), mat(MOUTH));
    smile.position.set(0, HEAD_CY - 0.26, 0.575);
    smile.rotation.set(-0.1, 0, Math.PI);
    hg.add(smile);

    // Pink blush on the cheeks
    for (const sx of [-0.4, 0.4]) {
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), mat(BLUSH));
      bl.position.set(sx, HEAD_CY - 0.1, 0.52);
      bl.scale.set(1, 0.55, 0.35);
      hg.add(bl);
    }
  }

  get position() {
    return this.group.position;
  }

  /** Move toward a point on the XZ plane. Returns true when arrived. */
  moveToward(target: THREE.Vector3, dt: number): boolean {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return true;
    const step = Math.min(dist, this.speed * dt);
    const dir = Math.atan2(dx, dz);
    this.heading = dir;
    this.group.position.x += Math.sin(dir) * step;
    this.group.position.z += Math.cos(dir) * step;
    return dist - step < 0.1;
  }

  /** Move along a normalised direction for this frame. */
  moveDirection(dirX: number, dirZ: number, dt: number) {
    this.heading = Math.atan2(dirX, dirZ);
    this.group.position.x += dirX * this.speed * dt;
    this.group.position.z += dirZ * this.speed * dt;
  }

  update(dt: number, moving: boolean) {
    // Smoothly turn toward heading
    let diff = this.heading - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 11);

    const target = moving ? 1 : 0;
    this.moveBlend += (target - this.moveBlend) * (1 - Math.exp(-dt / 0.08));
    const b = this.moveBlend;

    this.walkT += dt * 9.5;
    this.idleT += dt;
    this.updateBlink(dt);

    const s = Math.sin(this.walkT);

    // Legs
    const legAmp = 0.72;
    this.leftLegPivot.rotation.x = s * legAmp * b;
    this.rightLegPivot.rotation.x = -s * legAmp * b;

    // Arms
    const ap = Math.sin(this.walkT - 0.45);
    const armAmp = 0.62;
    const armIdle = Math.sin(this.idleT * 1.6) * 0.06;
    this.leftArmPivot.rotation.x = -ap * armAmp * b + armIdle * (1 - b);
    this.rightArmPivot.rotation.x = ap * armAmp * b + armIdle * (1 - b);

    // Torso lean / roll / squash
    const lean = 0.07 * b;
    const idleLean = Math.sin(this.idleT * 1.3) * 0.014 * (1 - b);
    this.bodyGroup.rotation.x = lean + idleLean;
    this.bodyGroup.rotation.z = Math.sin(this.walkT) * 0.04 * b;

    const squash = Math.sin(this.walkT * 2) * 0.035 * b;
    const breathe = Math.sin(this.idleT * 2.1) * 0.02 * (1 - b);
    const sy = squash + breathe;
    this.bodyGroup.scale.set(1 - sy * 0.5, 1 + sy, 1 - sy * 0.5);
    // Head stays rigid
    const ix = 1 / (1 - sy * 0.5);
    const iy = 1 / (1 + sy);
    this.headGroup.scale.set(ix, iy, ix);

    // Head micro-motion
    this.headGroup.rotation.x = -Math.sin(this.walkT * 2) * 0.03 * b - lean * 0.25;
    this.headGroup.rotation.z = Math.sin(this.idleT * 0.8) * 0.05 * (1 - b);
    this.headGroup.rotation.y = Math.sin(this.idleT * 0.6) * 0.04 * (1 - b);

    // Ear twitch (idle)
    const twitch = Math.sin(this.idleT * 3.7) * 0.03 * (1 - b);
    this.earL.rotation.z = 0.18 + twitch;
    this.earR.rotation.z = -0.18 + twitch;

    // Tail stub wiggle
    this.tailGroup.rotation.z = Math.sin(this.idleT * 2.2) * (0.12 + 0.1 * b);
    this.tailGroup.rotation.x = 0.05 + Math.sin(this.idleT * 2.9) * 0.05;

    // Hop / breathing bob
    const hop = Math.abs(Math.sin(this.walkT)) * 0.05 * b;
    const idleBob = Math.sin(this.idleT * 2.1) * 0.012 * (1 - b);
    this.group.position.y = hop + idleBob;
  }

  private updateBlink(dt: number) {
    if (this.blinking) {
      this.blinkT += dt / this.blinkDur;
      if (this.blinkT >= 1) {
        this.blinking = false;
        this.blinkT = 1;
        this.blinkTimer = 2.5 + Math.random() * 2.5;
      }
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinking = true;
        this.blinkT = 0;
      }
    }
    const k = this.blinking ? 0.1 + 0.9 * Math.abs(Math.cos(this.blinkT * Math.PI)) : 1;
    this.eyeGroupL.scale.y = k;
    this.eyeGroupR.scale.y = k;
  }
}
