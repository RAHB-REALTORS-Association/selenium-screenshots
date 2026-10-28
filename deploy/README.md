# Chromium sandbox profile

`chromium-seccomp.json` is vendored from Microsoft's Playwright project:
https://github.com/microsoft/playwright/blob/main/utils/docker/seccomp_profile.json

It retains Docker's syscall restrictions while allowing the namespace creation calls required by Chromium's sandbox. Guidance: https://playwright.dev/docs/docker#crawling-and-scraping

This file has been downloaded for review but has not yet been validated against the service container. No deployment uses it automatically. The temporary `seccomp=unconfined` diagnostic was network-isolated and is not a deployment recommendation.
