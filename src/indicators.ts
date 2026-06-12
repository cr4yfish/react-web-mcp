/**
 * Opt-in visual indicators for declarative form tools.
 *
 * While an agent invocation is pending (the agent filled the form and the
 * user is expected to review and submit it), the browser applies the CSS
 * pseudo-classes `:tool-form-active` (on the form) and `:tool-submit-active`
 * (on its submit button). This module ships a small default stylesheet for
 * that state, plus a `data-webmcp-active` attribute fallback maintained by
 * `<ToolForm indicators>` for engines that don't support the pseudo-classes
 * (the attribute also gives page CSS a stable hook).
 *
 * The selectors only match forms that opted in via the
 * `data-webmcp-indicators` attribute, and use `:is()` so the unknown
 * pseudo-class can't invalidate the whole rule in other browsers. Override
 * the color with `--webmcp-indicator-color`, or write your own CSS against
 * `:tool-form-active` / `[data-webmcp-active="true"]` instead.
 */

const STYLE_ATTRIBUTE = "data-webmcp-indicator-styles";

export const WEBMCP_INDICATOR_CSS = `
form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active="true"]) {
  outline: 2px solid var(--webmcp-indicator-color, #6d28d9);
  outline-offset: 3px;
}
form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active="true"])
  :is(button[type="submit"], input[type="submit"]) {
  outline: 2px solid var(--webmcp-indicator-color, #6d28d9);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active="true"])
    :is(button[type="submit"], input[type="submit"]) {
    animation: webmcp-submit-pulse 1.2s ease-in-out infinite;
  }
}
@keyframes webmcp-submit-pulse {
  50% { outline-offset: 5px; }
}
`;

let injectionCount = 0;

/**
 * Injects the default indicator stylesheet once per document (refcounted).
 * Returns a release function; the `<style>` element is removed when every
 * caller has released. Safe no-op during SSR.
 */
export function injectWebMCPIndicatorStyles(): () => void {
  if (typeof document === "undefined") return () => {};

  injectionCount++;
  let style = document.head.querySelector<HTMLStyleElement>(`style[${STYLE_ATTRIBUTE}]`);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute(STYLE_ATTRIBUTE, "");
    style.textContent = WEBMCP_INDICATOR_CSS;
    document.head.appendChild(style);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    injectionCount--;
    if (injectionCount <= 0) {
      injectionCount = 0;
      document.head.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
    }
  };
}
