# Staging runtime setup

`chromium-seccomp.json` is based on Docker's current default profile:
https://github.com/moby/profiles/blob/main/seccomp/default.json

The only intended policy change is allowing clone, clone3, setns and unshare for Chromium's user namespace sandbox. The older Microsoft profile was incompatible with the current local runtime. A sandboxed Chromium PNG capture passed locally with this updated profile and networking disabled. No `--no-sandbox`, privileged mode or SYS_ADMIN capability is needed.

`Proxy.Dockerfile` builds the staging Squid proxy. It accepts only HTTP(S) web ports, rejects private/special IPv4 destinations and all IPv6 destinations, disables caching and access logging, and runs as the proxy user. Publish no host ports and attach it only to the staging application network. Local tests returned 200 for https://example.com and 403 for loopback. Browser routing through the proxy does not replace container network isolation against a compromised browser.
