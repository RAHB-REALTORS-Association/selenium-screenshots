"""Bounded readiness checks for browser-rendered screenshots."""
import hashlib
import time

# Includes decoding and visual settling; navigation has a separate 25s timeout.
RENDER_BUDGET = 12


class RenderError(RuntimeError):
    """Visible page media could not be rendered."""

ASSET_READINESS = r"""
const done = arguments[arguments.length - 1];
const visible = el => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
};
const images = [...document.images].filter(i => visible(i) && (i.currentSrc || i.src));
const media = [...document.querySelectorAll('video')].filter(visible);
const waits = images.map(i => i.decode().catch(() => {}));
if (document.fonts) waits.push(document.fonts.ready);
for (const video of media) {
  if (video.readyState >= 2 || video.error || !video.currentSrc) continue;
  waits.push(new Promise(resolve => {
    video.addEventListener('loadeddata', resolve, {once: true});
    video.addEventListener('error', resolve, {once: true});
  }));
}
let finished = false;
const finish = () => {
  if (finished) return;
  finished = true;
  done({
    animated: media.length > 0 || [...document.querySelectorAll('canvas')].some(visible),
    mediaErrors: media.filter(v => v.error && !v.poster).map(v => v.error.code)
  });
};
const timer = setTimeout(finish, 4000);
Promise.allSettled(waits).then(() => { clearTimeout(timer); finish(); });
"""


def wait_for_render(driver):
    """Wait for visible assets, then stable pixels, without hanging on animations.

    Video/canvas introductions get a longer minimum dwell because they can report
    loaded while still showing their initial blank frame. Infinite animations
    reach the fixed deadline and are captured at that point.
    """
    started = time.monotonic()
    deadline = started + RENDER_BUDGET
    state = driver.execute_async_script(ASSET_READINESS)
    if state.get('mediaErrors'):
        raise RenderError('Visible video could not be decoded or loaded by the capture browser')
    minimum = 8 if state.get('animated') else 2
    previous = None
    stable_since = time.monotonic()
    while time.monotonic() < deadline:
        fingerprint = hashlib.sha256(driver.get_screenshot_as_png()).digest()
        now = time.monotonic()
        if fingerprint != previous:
            previous = fingerprint
            stable_since = now
        if now - started >= minimum and now - stable_since >= 1:
            return
        time.sleep(0.5)
