import { useEffect, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Engine } from '../three/engine';
import { router } from '../router';

/**
 * App shell: just a canvas + loading veil. ALL UI (dialogs, HUD, clock) is
 * built from three.js meshes + SDF text inside the WebGL scene — zero DOM UI.
 * Routes still drive which dialog is open (URL stays the source of truth).
 */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas);
    engineRef.current = engine;
    (window as unknown as Record<string, unknown>).__engine = engine;
    const offs = [
      engine.on('ready', () => setReady(true)),
      engine.on('interact', (route) => void router.navigate({ to: route as string })),
    ];
    engine.setRoute(router.state.location.pathname);
    engine.start();

    return () => {
      offs.forEach((off) => off());
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Route changes open / close the in-world dialog
  useEffect(() => {
    engineRef.current?.setRoute(pathname);
  }, [pathname]);

  // Escape closes exhibit panel / dialogs via the engine's priority chain
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') engineRef.current?.onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="stage">
      <canvas ref={canvasRef} />
      <div className={ready ? 'veil hidden' : 'veil'}>
        <div className="leaf">🍃</div>
        <div>Loading the island…</div>
      </div>
    </div>
  );
}
