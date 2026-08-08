import { useEffect, useRef, useState } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { installHtmlInCanvasPolyfill, uninstallHtmlInCanvasPolyfill } from 'three-html-render';
import { patchHtmlInCanvasCompat } from '../three/hicCompat';
import { Engine } from '../three/engine';
import { loadFontPageStyles } from './font';
import { profile, locations } from '../content';
import { router } from '../router';
import { Clock } from './dialogs';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Home Square',
  '/about': locations.about.name,
  '/projects': locations.projects.name,
  '/contact': locations.contact.name,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const canvas = canvasRef.current;
    const dialogEl = dialogRef.current;
    const hudEl = hudRef.current;
    if (!canvas || !dialogEl || !hudEl) return;
    let disposed = false;
    let engine: Engine | undefined;
    const offs: (() => void)[] = [];

    (async () => {
      // Inline the font for the SVG-rasteriser, then install the
      // HTML-in-Canvas polyfill (native fast-path is used when present).
      // NOTE: the polyfill may relocate canvas children into an off-screen
      // host — that's why we hold React refs instead of querySelector.
      const pageStyles = await loadFontPageStyles();
      if (disposed) return;
      installHtmlInCanvasPolyfill({ pageStyles });
      patchHtmlInCanvasCompat();

      engine = new Engine(canvas, { dialogEl, hudEl });
      engineRef.current = engine;
      (window as unknown as Record<string, unknown>).__engine = engine;
      offs.push(engine.on('ready', () => setReady(true)));
      offs.push(engine.on('prompt', (t) => setPrompt((t as string | null) ?? null)));
      offs.push(
        engine.on('interact', (route) => {
          void router.navigate({ to: route as string });
        }),
      );
      engine.setDialogOpen(router.state.location.pathname !== '/');
      engine.start();

      // The polyfill's fullscreen host overlay would otherwise swallow every
      // pointer event. Let clicks pass through to the canvas — the in-canvas
      // UI children keep their own pointer-events:auto, so dialogs and links
      // stay fully interactive.
      const releaseHost = () => {
        const host = document.querySelector<HTMLElement>('div[data-html-in-canvas-host]');
        if (host) host.style.pointerEvents = 'none';
      };
      releaseHost();
      window.setTimeout(releaseHost, 0);

      // In-canvas DOM is reparented by the polyfill, so React's synthetic
      // events can't reach it. Delegate internal navigation natively:
      // any element with [data-nav] navigates on click (capture phase,
      // before the UI layer's stopPropagation).
      const onNavClick = (e: MouseEvent) => {
        const t = (e.target as HTMLElement | null)?.closest?.('[data-nav]');
        const to = t?.getAttribute('data-nav');
        if (to) {
          e.preventDefault();
          void router.navigate({ to });
        }
      };
      window.addEventListener('click', onNavClick, true);
      offs.push(() => window.removeEventListener('click', onNavClick, true));
    })();

    return () => {
      disposed = true;
      offs.forEach((off) => off());
      engine?.dispose();
      engineRef.current = null;
      uninstallHtmlInCanvasPolyfill();
    };
  }, []);

  // Route changes open / close the in-world dialog
  useEffect(() => {
    engineRef.current?.setDialogOpen(pathname !== '/');
  }, [pathname]);

  // Escape returns to the island
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void router.navigate({ to: '/' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="stage">
      {/* Children of <canvas layoutsubtree> are laid out by the browser but
          only become visible once drawn into WebGL (HTML-in-Canvas). */}
      <canvas ref={canvasRef} {...({ layoutsubtree: '' } as object)}>
        <div id="hud" ref={hudRef} className="hud">
          <div className="hud-title">
            <span>🍃</span>
            <span>
              {profile.name} · {ROUTE_TITLES[pathname] ?? 'Island'}
            </span>
          </div>
          <div className="hud-sub">
            {prompt ? (
              <span className="hud-prompt">{prompt}</span>
            ) : (
              'WASD / arrows / click to walk · E to interact'
            )}
          </div>
        </div>
        <div id="dialog-panel" ref={dialogRef} className="dialog-host">
          <Outlet />
        </div>
        <Clock />
      </canvas>
      <div className={ready ? 'veil hidden' : 'veil'}>
        <div className="leaf">🍃</div>
        <div>Loading the island…</div>
      </div>
    </div>
  );
}
