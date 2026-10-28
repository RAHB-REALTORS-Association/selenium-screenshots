# Git-backed Coolify Compose deployment

`compose.yaml` is the deployment unit. It uses matching API, proxy and gateway images from GHCR and needs Linux amd64, Docker Compose v2.23.1+ and support for Chromium's user namespace sandbox.

## Components and network boundary

- `gateway`: unprivileged Nginx on port 8080. Route the public API hostname to this component. It forwards requests over `/run/capture/api.sock`.
- `api`: the authenticated API and sandboxed browser. `network_mode: none` prevents direct external DNS/TCP/UDP access. It has only loopback and socket volumes. A supervised local listener on 127.0.0.1:3128 carries browser proxy traffic to `/run/egress/proxy.sock`.
- `proxy`: Squid resolves destinations and filters redirects/subresources. Its Unix listener carries traffic to Squid's local HTTP proxy. Public destinations are the default. Setting `ALLOW_PRIVATE_TARGETS=true` permits RFC1918 IPv4 destinations; loopback, link-local/metadata, reserved addresses and IPv6 remain blocked.

Socket volumes contain runtime sockets, not business data. API and proxy image directories initialize volume ownership. Gateway supplementary group 10001 can connect to the API socket; its mount is read-only. The gateway and proxy explicitly clear `BEARER_TOKEN` so Coolify's shared environment-file injection does not give them the API credential.

## Configure Coolify

1. Create an Application from this private GitHub repository using the existing Git integration. Select `master` and the Docker Compose build strategy.
2. Set Base Directory to `/` and Docker Compose Location to `/compose.yaml`. Enable **Preserve repository during deployment** so the sandbox profile remains available. Keep normal managed Compose deployment; the file requires no raw-mode proxy labels or predefined-network connection.
3. Load the Compose definition. Set the required `BEARER_TOKEN` in Environment Variables. `ALLOW_PRIVATE_TARGETS` defaults to `false` and `ALLOWED_ORIGINS` defaults to the public GitHub Pages client. No credential belongs in Git.
4. Configure the public domain on `gateway`, internal port 8080. Do not assign public domains or host ports to `api` or `proxy`.
5. Deploy and verify all three health checks. Inspect Deployable Compose and confirm `api` still has `network_mode: none`, no networks and no published ports. Verify a real authenticated capture through the gateway.

For a preview, override `API_IMAGE`, `PROXY_IMAGE` and `GATEWAY_IMAGE` with the corresponding immutable preview tags. For a release, the defaults in `compose.yaml` select matching versioned images.

## Sandbox profile

`chromium-seccomp.json` is based on Docker's default profile, with clone, clone3, setns, unshare and chroot allowed for Chromium's user namespace sandbox. The chroot syscall must remain available inside that namespace when all outer container capabilities are dropped; the kernel still enforces namespace capabilities. Compose reads the profile from the repository during container creation. No privileged mode, SYS_ADMIN capability or `--no-sandbox` flag is required. The full stack test verifies the browser with dropped capabilities and no-new-privileges enabled.

## Migration and rollback

Deploy the new Compose application on a temporary verification domain first. Once health, authentication, private-target filtering and visual capture pass, transfer the existing API domain to `gateway` using its existing protocol choice. Verify the public client, then stop the prior API and proxy resources. Retain them for rollback; there is no persistent application data to migrate. A rollback transfers the domain back and starts the previous resources.

## Local verification

Copy `.env.example` to `.env`, set a local token and run `docker compose up -d --wait`. The canonical file publishes no host ports. For CI, `tests/compose.test.yaml` adds a loopback-only gateway port and controlled fixture; `tests/stack_smoke.py` validates the complete path with locally built images and removes its disposable containers/volumes afterward.
