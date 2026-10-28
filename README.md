# Screenshot API

A Flask API that captures websites using Chrome. Both `GET /screenshot` and `GET /api/capture` accept a bearer token and return an image.

## Required configuration

- `BEARER_TOKEN`: API token. Requests fail closed if it is missing.
- `SCREENSHOT_PROXY`: HTTP proxy URL, for example `http://egress-proxy:3128`.
- `ALLOWED_ORIGINS`: comma-separated allowed web client origins.

**The proxy is a security boundary.** It must resolve destinations itself and reject loopback, private, link-local, reserved and metadata addresses, including IPv6, redirects, DNS rebinding and subresources. The container's network must prevent Chrome from bypassing that proxy, including direct DNS, TCP and UDP traffic. The application does not provide this proxy or enforce network policy. Do not expose the service until these controls are deployed and verified. Allow the service to reach only the proxy and required infrastructure.

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
