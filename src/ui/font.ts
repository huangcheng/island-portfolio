/** Fetches the bundled font and returns a @font-face rule with a data-URI,
 *  so the SVG-foreignObject rasteriser (polyfill path) can use the same font. */
export async function loadFontPageStyles(): Promise<string | undefined> {
  try {
    const buf = await fetch('/fonts/baloo2.woff2').then((r) => {
      if (!r.ok) throw new Error(`font ${r.status}`);
      return r.arrayBuffer();
    });
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const b64 = btoa(binary);
    return `@font-face{font-family:'Baloo 2';src:url(data:font/woff2;base64,${b64}) format('woff2');font-weight:400 800;font-style:normal;}`;
  } catch {
    return undefined;
  }
}
