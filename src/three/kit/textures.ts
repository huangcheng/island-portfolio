import * as THREE from 'three';
import { mulberry32 } from './core';

// ── Grass texture: iconic AC darker-blade-triangle scatter ─────────────────
export function makeGrassTexture(
  base = '#7ec850',
  shades = ['#6cb83f', '#5fa835', '#74c045', '#69bf40'],
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 1024);
  const rng = mulberry32(20260808);
  for (let i = 0; i < 520; i++) {
    const x = rng() * 1024;
    const y = rng() * 1024;
    const r = 9 + rng() * 11;
    ctx.fillStyle = shades[(rng() * shades.length) | 0];
    ctx.beginPath();
    const b = rng() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const ang = b + (k * Math.PI * 2) / 3;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // a few lighter highlights for depth
  for (let i = 0; i < 120; i++) {
    const x = rng() * 1024;
    const y = rng() * 1024;
    ctx.fillStyle = 'rgba(147,217,106,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 5 + rng() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  return tex;
}

/** Dirt cliff texture: horizontal wavy strata + speckle, like AC rock walls. */
export function makeDirtTexture(base: string, band: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rng = mulberry32(base.length * 131 + band.length * 17);
  ctx.strokeStyle = band;
  for (let row = 0; row < 4; row++) {
    ctx.lineWidth = 5 + rng() * 5;
    ctx.globalAlpha = 0.35 + rng() * 0.2;
    ctx.beginPath();
    const y = 30 + row * 62 + rng() * 12;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.06 + row) * 5 + (rng() - 0.5) * 4);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = band;
    ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 1);
  return tex;
}

/** Sand with subtle speckles + tiny shell flecks. */
export function makeSandTexture(base = '#f7e6ad'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  const rng = mulberry32(777);
  for (let i = 0; i < 520; i++) {
    ctx.fillStyle = rng() < 0.6 ? '#ecd9a0' : '#e6cf8e';
    ctx.beginPath();
    ctx.arc(rng() * 512, rng() * 512, 1 + rng() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = '#fff8e7';
    ctx.beginPath();
    ctx.arc(rng() * 512, rng() * 512, 1 + rng() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function makeStripedTexture(a: string, b: string, bands = 6): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const w = 256 / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect(i * w, 0, w + 1, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeChevronTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3fb8af';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#fffef7';
  ctx.lineWidth = 13;
  ctx.lineJoin = 'round';
  for (let row = 0; row < 5; row++) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 32) {
      const y = row * 56 + 18 + (x / 32) % 2 * 16;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
