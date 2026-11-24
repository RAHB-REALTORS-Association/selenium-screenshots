# Changelog

## 1.7.4

- Move the gateway to the maintained `nginx/nginx-unprivileged` image, pinned to NGINX 1.30.8 and its image digest. Update Brotli to 1.2.1-r0, libxslt to 1.1.43-r4 and curl/libcurl to 8.23.0-r0, addressing the gateway findings reported by Coolify.
- Scan the built gateway image in PR, preview and release CI; block on fixable high or critical vulnerabilities before publishing.
- Pin matching API, proxy and gateway Compose images to v1.7.4; refresh the client version, asset cache and API reference.
- No configuration or data migrations are required. Deployments remain manual.

## 1.7.3

- Upgrade Selenium from 4.52.0 to 4.53.0 (#111).
- Include the Dependabot auto-merge workflow and expanded required CI checks introduced in #110. Releases and Coolify deployment remain manual.
- Pin matching API, proxy and gateway Compose images to v1.7.3; refresh the client version, asset cache and API reference.
- No configuration or data migrations are required.

## 1.7.2

- Upgrade Gunicorn from 26.2.0 to 27.0.1 (#109), retaining the gthread worker configuration and shared two-capture limit.
- Pin matching API, proxy and gateway Compose images to v1.7.2; refresh the client version, asset cache and API reference.
- Gunicorn 27 rejects malformed HTTP request framing more strictly. No application configuration or data migration is required.

## 1.7.1

- Upgrade Selenium from 4.51.0 to 4.52.0 (#108).
- Pin matching API, proxy and gateway Compose images to v1.7.1; update the client version, asset cache and API reference.
- Remove the obsolete Dependabot auto-release workflow. Releases use the tag-driven Docker pipeline so browser, proxy and full-stack checks finish before image publication.
- No configuration or data migrations are required.

## 1.7.0

- Replace the Bootstrap client with a responsive Cornerstone capture workspace, native accessible settings dialog, consistent SVG icons, and locally served assets. Remove Bootstrap, Font Awesome and Axios CDN dependencies.
- Add full-page capture to the web client, viewport presets and custom dimensions, and clearer preview/loading/error states. Complete feature request #19; existing API routes and capture limits remain supported.
- Preserve previously saved API settings and session-only defaults. Keep credentials in bearer headers; query authentication request #20 was declined by the maintainer.
- Show actual image dimensions, size and capture time; preserve the captured download format and last successful image after a failed retry. Release old object URLs when replacing a capture.
- Upgrade Python from 3.11 to 3.15.2 across the digest-pinned container, CI and local development version.
- Upgrade Gunicorn from 23.0.0 to 26.2.0 (dependency PR #98), retaining the existing gthread workers and shared capture limit.
- Pin all three Compose images to v1.7.0 and refresh the service-worker cache and API reference. No new environment variables, storage migrations or infrastructure are required.
