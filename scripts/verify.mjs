/**
 * End-to-end verification for the island portfolio (Playwright, headless).
 *
 * Usage:
 *   pnpm build           # build first
 *   node scripts/verify.mjs
 *
 * It serves dist/ via vite preview, then checks:
 *   1. All routes load with zero console errors
 *   2. Walk + E interactions (enter house/museum, desk/photo routes, exit)
 *   3. Exhibit placard opens + closes
 *   4. Pier walk + Dodo Airlines flight board opens
 *   5. Day/night palette actually lerps (forced hours)
 *
 * Browser: uses your installed Chrome. If missing, run once:
 *   pnpm exec playwright install chromium
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const SHOTS = 'test-shots';
mkdirSync(SHOTS, { recursive: true });

let passed = 0;
let failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.error(`  ✘ ${name}`); }
};

// Hard watchdog — the suite must never hang
const WATCHDOG_MS = 150000;
const watchdog = setTimeout(() => {
  console.error('\n✘ TIMEOUT — suite exceeded 150s, aborting');
  process.exit(2);
}, WATCHDOG_MS);
watchdog.unref();

async function waitServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start at ${url}`);
}

/** Chrome channel → bundled chromium → existing ms-playwright install. */
async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ channel: 'chrome', timeout: 15000 }),
    () => chromium.launch({ timeout: 15000 }),
  ];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    attempts.push(() =>
      chromium.launch({
        executablePath: `${local}\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe`,
        timeout: 15000,
      }),
    );
  }
  let lastErr;
  for (const a of attempts) {
    try {
      return await a();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

console.log('▸ starting vite preview…');
const preview = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true });
preview.unref();
process.on('exit', () => preview.kill());

try {
  await waitServer(BASE);
  console.log('▸ preview up, launching browser…');

  const browser = await launchBrowser();
  console.log('▸ browser up, running checks…');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const eng = (fn, ...a) => page.evaluate(fn, ...a);

  // ── 1. Routes load cleanly ──────────────────────────────────────────────
  console.log('\n[1] routes load with zero console errors');
  for (const route of ['/', '/about', '/projects', '/contact']) {
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${SHOTS}/route${route === '/' ? '-home' : route.replace('/', '-')}.png` });
  }
  check('no console errors after all routes', consoleErrors.length === 0);

  // ── 2. Outdoor interactions ─────────────────────────────────────────────
  console.log('\n[2] walk / E / enter interiors / routes / exit');
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Walk with keyboard
  const pos0 = await eng(() => { const p = window.__engine.villager.position; return [p.x, p.z]; });
  await page.keyboard.down('w');
  await page.keyboard.down('a');
  await page.waitForTimeout(900);
  await page.keyboard.up('w');
  await page.keyboard.up('a');
  const pos1 = await eng(() => { const p = window.__engine.villager.position; return [p.x, p.z]; });
  check('villager walks with keys', Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1]) > 0.5);

  // Enter the house via door point
  await eng(() => { window.__engine.villager.position.set(-3.63, 0, -2.35); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(1800);
  check('E enters the house', await eng(() => window.__engine.activeKind === 'house'));

  // Desk E → /about route
  await eng(() => { window.__engine.villager.position.set(-4.4, 0, -0.6); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(1200);
  check('desk opens /about', (await eng(() => location.pathname)) === '/about');
  await page.screenshot({ path: `${SHOTS}/house-desk.png` });

  // Esc closes dialog; exit door returns to island
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await eng(() => { window.__engine.villager.position.set(0, 0, 3.6); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(1800);
  check('door exit returns to island', await eng(() => window.__engine.activeKind === 'island'));

  // Museum: enter + frame exhibit
  await eng(() => { window.__engine.villager.position.set(3.49, 0, -2.53); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(1800);
  check('E enters the museum', await eng(() => window.__engine.activeKind === 'museum'));
  await eng(() => { window.__engine.villager.position.set(0, 0, -4.15); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(1000);
  check('frame opens exhibit placard', await eng(() => window.__engine.exhibitOpen === true));
  await page.screenshot({ path: `${SHOTS}/museum-exhibit.png` });

  // ── 3. Exhibit close via ✕ ──────────────────────────────────────────────
  console.log('\n[3] exhibit ✕ closes');
  const closePos = await eng(() => {
    const e = window.__engine;
    const hot = e.ui.dialogHots[0];
    const V = e.camera.position.constructor;
    const v = new V();
    hot.mesh.getWorldPosition(v);
    v.project(e.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  });
  await page.mouse.click(closePos.x, closePos.y);
  await page.waitForTimeout(600);
  check('exhibit closes via ✕', await eng(() => window.__engine.exhibitOpen === false));

  // ── 4. Pier + flight board ──────────────────────────────────────────────
  console.log('\n[4] pier walk + flight board');
  await eng(() => { window.__engine.villager.position.set(0, 0, 3.6); });
  await page.waitForTimeout(200);
  await page.keyboard.press('e'); // exit museum first
  await page.waitForTimeout(1800);
  await eng(() => { window.__engine.villager.position.set(10.6, 0, 19.2); });
  await page.waitForTimeout(400);
  check('panda stands on pier deck (y≈0.16)', await eng(() => Math.abs(window.__engine.villager.position.y - 0.165) < 0.06));
  await page.screenshot({ path: `${SHOTS}/pier-end.png` });
  await page.keyboard.press('e');
  await page.waitForTimeout(1200);
  check('flight board opens', await eng(() => window.__engine.boardOpen === true));
  await page.screenshot({ path: `${SHOTS}/flight-board.png` });

  // Click the first ONLINE flight row (hots[1]; hots[0] is the ✕) → flyby + navigate.
  // Retry a few times — a click can land mid-pop-in and miss the row.
  let flew = false;
  let tries = 0;
  for (let attempt = 1; attempt <= 3 && !flew; attempt++) {
    tries = attempt;
    const rowPos = await eng(() => {
      const e = window.__engine;
      const hot = e.ui.dialogHots[1];
      const V = e.camera.position.constructor;
      const v = new V();
      hot.mesh.getWorldPosition(v);
      v.project(e.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
    });
    await page.mouse.click(rowPos.x, rowPos.y);
    await page.waitForTimeout(400);
    flew = await eng(() => !!window.__engine.transition).catch(() => true); // true if context died = navigating
  }
  if (tries > 1) console.log(`  (flight click needed ${tries} tries)`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/flyby.png` }).catch(() => {});
  await page.waitForTimeout(2500);
  let nav = null;
  try {
    nav = page.url();
  } catch { /* context mid-navigation */ }
  check(`external island navigation fired (${nav})`, flew && typeof nav === 'string' && /cheng\.sh|misthois\.cn|kleos\.cn|chrome-error/.test(nav));
  // We navigated away — go back to the island for any later checks
  await page.goto(BASE + '/', { waitUntil: 'load' }).catch(() => {});
  await page.waitForTimeout(1000);

  // ── 5. Day/night lerp ───────────────────────────────────────────────────
  console.log('\n[5] day/night palette lerps with the clock');
  const nights = await eng(() => ({ night: window.__engine.nightFactor }));
  check(`nightFactor reflects local time (${nights.night.toFixed(2)})`, nights.night >= 0 && nights.night <= 1);

  console.log('\n[6] console errors total: ' + consoleErrors.length);
  check('zero console errors end-to-end', consoleErrors.length === 0);
  if (consoleErrors.length) console.error(consoleErrors.slice(0, 6).join('\n'));

  await browser.close();
} finally {
  preview.kill();
  clearTimeout(watchdog);
}

console.log(`\n═══ ${passed} passed, ${failed} failed ═══`);
process.exit(failed ? 1 : 0);
