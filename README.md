# Screenshot API

A Flask API that captures websites using Selenium and a Chromium browser. Both `GET /screenshot` and `GET /api/capture` accept a bearer token and return an image.

## Required configuration

- `BEARER_TOKEN`: API token. Requests fail closed if it is missing.
- `SCREENSHOT_PROXY`: HTTP proxy URL, for example `http://egress-proxy:3128`.
- `ALLOWED_ORIGINS`: comma-separated allowed web client origins.
- `ALLOW_PRIVATE_TARGETS`: `false` by default. Set `true` on **both the API and proxy** to allow RFC1918 IPv4 destinations. Loopback, metadata/link-local, reserved addresses and IPv6 remain blocked. A missing or invalid setting cannot enable private captures.

Two captures can run at once across the preloaded Gunicorn workers. Extra requests receive HTTP 503 with `Retry-After: 5`; callers should retry with backoff. Captures run in separate processes with a 55-second deadline, and their process groups are terminated on completion, error or timeout. The browser process environment excludes the API bearer token and deployment credentials. `GET /health` returns 200 only when required configuration is valid.

**The proxy is a security boundary.** The recommended `compose.yaml` bundles an ingress gateway, the API/browser and a filtering proxy. The API uses `network_mode: none`: ingress and proxy traffic cross Unix sockets on dedicated volumes, so the browser cannot bypass the proxy through another container network. Coolify can manage its normal networks without attaching the capture container. For standalone image deployments, provide equivalent proxy and network controls yourself. See [deployment instructions](deploy/README.md).

## API

```
GET /screenshot?url=https%3A%2F%2Fexample.com&viewport=1440x900&format=PNG&delay=0&fullpage=0
Authorization: Bearer <token>
```

`url` must be HTTP or HTTPS. `viewport` defaults to 1440x900 and is limited to 16 million pixels. `format` is PNG or JPG. `delay` is 0–10 seconds. `fullpage=1` captures the page within the 16 million pixel and 10,000 pixel dimension limits. Responses contain image bytes with the corresponding MIME type. Internal destinations are not supported by the recommended proxy policy.

## Run and test

Install `requirements.txt` in a virtual environment, configure both required variables and run `gunicorn --config gunicorn_config.py app:app`. Run `python -m unittest discover -s tests -v` for the API contract tests. The Docker image listens on port 8080; configure its network and proxy before exposing it. Chrome sandbox support must be enabled in the container runtime.

### Local Chrome verification (macOS)

The service can use installed Chrome through Selenium Manager; no Docker is needed. Omit `CHROME_BIN` and `CHROMEDRIVER_BIN` to use automatic discovery, or set them explicitly. Selenium creates a temporary browser profile, rather than attaching to your personal Chrome session.

```
.venv/bin/python -m pip install -r requirements.txt
PYTHONPATH=. SE_AVOID_STATS=true .venv/bin/python tests/browser_smoke.py
```

The browser smoke uses an embedded fixture, so it does not require an outbound proxy or contact a target website. It verifies PNG/JPEG signatures, an exact 800×600 viewport, and an 800×1800 full-page capture; images are saved under `test-results/`. Serving real HTTP(S) captures still requires the configured filtering proxy.

Capture readiness waits for visible image decoding, fonts and video data, then samples rendered pixels until stable. Static pages settle quickly; video/canvas introductions get at least eight seconds, with a twelve-second render budget so continuous animation cannot hang a request. The requested delay is additional. Animated pages can still differ by frame; the service does not rewrite their animation state.

### Linux video support

The amd64 server image uses Brave 1.98.62 (Chromium 156.0.8078.74) with its opt-in FFmpeg software HEVC decoder. This avoids blank HEVC video on a server without a hardware decoder. ChromeDriver is pinned to the matching Chromium version and its download SHA256 is verified. Local macOS testing can continue to use installed Chrome. Update the two pinned browser/driver versions together when rebuilding for browser security updates.

CI verifies decoded pixels from a generated HEVC fixture inside the actual server image. Visible video failures without a poster produce a 502 error instead of a silently incomplete screenshot.

### Releases

Push a `v`-prefixed semantic version tag on merged `master`. The release workflow runs unit, overload, client, sandboxed browser, proxy-policy and full Compose stack checks, then publishes the exact tested amd64 images to GHCR. API tags include `v1.7.0`, `1.7.0`, `1.7` and `latest`; proxy tags include `proxy-v1.7.0` and `proxy-latest`; gateway tags include `gateway-v1.7.0` and `gateway-latest`. The Compose file pins matching versioned images. Release publication does not invoke the legacy deployment webhook.

## Web client

The GitHub Pages client is a dependency-free static application following the Cornerstone application blueprint: navy navigation, a responsive capture workspace, accessible connection dialog, and explicit empty, loading, error, and completed states. No frontend build step or third-party CDN assets are required.

1. Open **API settings**, enter the API base URL and bearer key, and save. Settings use session storage by default; **Remember settings on this device** uses local storage. Existing saved settings from earlier releases are preserved. Only remember credentials on a trusted device.
2. Enter a complete HTTP(S) website URL. Choose a viewport preset or custom dimensions, PNG/JPG, and an optional additional delay.
3. Enable **Full page** to capture beyond the viewport. Server limits still apply: 16 million pixels and 10,000 pixels per dimension.
4. Capture, inspect the preview and its dimensions, then download. Changing options after a capture does not change that image's download format. A failed retry preserves the last successful preview.

Keys are sent only in the Authorization header, never in request URLs. Screenshots are held as browser object URLs, rather than saved in application history or uploaded to storage. Closing or reloading the page clears the preview. API settings and capture inputs are separate: cancelling the settings dialog does not change the connection.

For local UI work, serve `docs/` with a static server and use an API whose `ALLOWED_ORIGINS` includes that local origin. Run `node --test tests/test_client.cjs` for request, validation, settings migration, download, error and cache tests. Test the actual browser at desktop and phone widths as well.
