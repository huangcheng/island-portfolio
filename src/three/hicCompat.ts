/**
 * Compat shim between three.js (>= r184) and three-html-render's polyfill.
 *
 * three.js picks its texElementImage2D call style based on the function's
 * declared `.length` (3 = WICG spec form, otherwise the legacy 6-arg form).
 * The polyfill implements the legacy 6-arg form but its implementation
 * `function (e, t, o, ...rest)` accidentally *declares* length 3, which
 * makes three.js call the spec form that the polyfill then rejects.
 * Declaring length 6 restores the legacy path, which the polyfill handles.
 */
export function patchHtmlInCanvasCompat() {
  for (const proto of [
    typeof WebGLRenderingContext !== 'undefined' ? WebGLRenderingContext.prototype : null,
    typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext.prototype : null,
  ]) {
    if (!proto) continue;
    const fn = (proto as unknown as Record<string, unknown>).texElementImage2D;
    if (typeof fn === 'function' && fn.length !== 6) {
      try {
        Object.defineProperty(fn, 'length', { value: 6, configurable: true });
      } catch {
        // Non-configurable — the native API is present, nothing to patch.
      }
    }
  }
}
