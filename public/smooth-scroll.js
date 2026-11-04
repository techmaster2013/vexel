// Smooth scrolling: mouse-wheel notches glide to their target with an eased
// animation instead of jumping. Touchpads, touch screens and keyboards already
// scroll smoothly, so only wheel notches (large, discrete deltas) are handled.
// Off in lightweight mode, with "Reduce motion", and when the system asks for
// reduced motion; inner scroll areas (chat, lists) and pinch-zoom are untouched.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const enabled = () =>
  !reducedMotion.matches &&
  !document.body.classList.contains("lite") &&
  !document.body.classList.contains("reduce");

const page = () => document.scrollingElement || document.documentElement;
const maxScroll = () => page().scrollHeight - innerHeight;
let target = null,
  frame = 0;

// True when the wheel should scroll something other than the page itself.
function innerScroller(node, dy) {
  for (let el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof Element)) continue;
    const { overflowY } = getComputedStyle(el);
    if (!/(auto|scroll|overlay)/.test(overflowY) || el.scrollHeight <= el.clientHeight) continue;
    if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
  }
  return false;
}

function step() {
  const current = scrollY,
    distance = target - current;
  if (Math.abs(distance) < 0.5) {
    scrollTo({ top: target, behavior: "instant" });
    target = null;
    frame = 0;
    return;
  }
  // Ease out: cover a fixed share of the remaining distance each frame.
  scrollTo({ top: current + distance * 0.18, behavior: "instant" });
  frame = requestAnimationFrame(step);
}

addEventListener(
  "wheel",
  (e) => {
    if (!enabled() || e.defaultPrevented || e.ctrlKey || e.shiftKey || e.deltaX) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    // Touchpads send many small deltas and already feel smooth; leave them native.
    if (Math.abs(dy) < 50 || innerScroller(e.target, dy)) return;
    if (document.querySelector("dialog[open]")) return;
    e.preventDefault();
    target = Math.max(0, Math.min(maxScroll(), (target ?? scrollY) + dy));
    if (!frame) frame = requestAnimationFrame(step);
  },
  { passive: false },
);

// Anything else that moves the page (scrollbar drag, keys, touch) cancels the glide.
const cancel = () => {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  target = null;
};
addEventListener("keydown", cancel);
addEventListener("pointerdown", cancel);
addEventListener("touchstart", cancel, { passive: true });
addEventListener("hashchange", cancel);
