# Changelog

## 1.7.0

- Replace the Bootstrap client with a responsive Cornerstone capture workspace, native accessible settings dialog, consistent SVG icons, and locally served assets. Remove Bootstrap, Font Awesome and Axios CDN dependencies.
- Add full-page capture to the web client, viewport presets and custom dimensions, and clearer preview/loading/error states. Complete feature request #19; existing API routes and capture limits remain supported.
- Preserve previously saved API settings and session-only defaults. Keep credentials in bearer headers; query authentication request #20 was declined by the maintainer.
- Show actual image dimensions, size and capture time; preserve the captured download format and last successful image after a failed retry. Release old object URLs when replacing a capture.
- Upgrade Gunicorn from 23.0.0 to 26.2.0 (dependency PR #98), retaining the existing gthread workers and shared capture limit.
- Pin all three Compose images to v1.7.0 and refresh the service-worker cache and API reference. No new environment variables, storage migrations or infrastructure are required.
