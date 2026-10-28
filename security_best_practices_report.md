# Repository assessment and security review

Reviewed 2026-10-28 at `fd7d25a7d89a876374326467a6ed6c1aca5bec1c` (local and GitHub master matched).

## Recommendation

Replace the small screenshot backend in stages while preserving the existing API contract and container deployment approach. The backend totals 130 lines across app.py, utilities.py, resources/screenshot.py, and gunicorn_config.py. A focused replacement is reasonable; the dependency backlog alone does not justify changing frameworks or adding infrastructure.

Keep `/screenshot`, `/api/capture`, bearer headers, viewport/format/delay parameters, port 8080, fonts, and GHCR-to-Coolify delivery. Repair the Dockerfile and release workflow rather than assuming they are already reliable. Network isolation for an untrusted browser is the most important design requirement.

This review changed no application code, GitHub state, or deployments.

## GitHub inventory

The old `justinh-rahb` origin resolves through the local GitHub CLI to the private [RAHB repository](https://github.com/RAHB-REALTORS-Association/selenium-screenshots). The connected GitHub plugin lacked access; authenticated local `gh` supplied these results.

- Three open issues: [#15 OpenAPI/Redoc](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/issues/15), [#19 full-page capture](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/issues/19), and [#20 query-string secret](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/issues/20). #15 appears substantially implemented in docs/openapi.yaml and the Pages workflow, but the deployed documentation was not verified.
- Six open PRs, all dependency updates: [#75](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/pull/75), [#88](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/pull/88), [#98](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/pull/98), [#100](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/pull/100), [#101](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/pull/101), [#102](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/pull/102). Four report failing CI; #100 and #101 report no checks. Three PRs overlap on urllib3.
- Nine open Dependabot alerts: six high and three medium. Eight concern urllib3, with fixes extending through 2.8.0; one concerns Werkzeug, fixed in 3.1.9. Alert severity is advisory severity, not proof that each vulnerable path is reachable in this app. The Windows-specific Werkzeug finding has limited apparent relevance to the Linux image.
- Code-scanning alert enumeration returned HTTP 403: “Code Security must be enabled for this repository to use code scanning.” Recent CodeQL workflow runs nevertheless show success; successful jobs do not establish accessible or active alert coverage. Repository advisory enumeration returned 404, so private vulnerability reports could not be assessed.
- [Latest Selenium PR CI log](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/actions/runs/40697095979): Selenium 4.51.0 requires urllib3 >=2.6.3,<3.0, conflicting with the explicit 2.4.0 pin. Python 3.9 also cannot install that Selenium version. Update coupled dependencies together and align the test matrix with the supported runtime.

## Security findings

### 1. High — Browser can access internal network targets

- Rule: FLASK-SSRF-001.
- Location: utilities.py:15–20; resources/screenshot.py:24–26,62.
- Evidence: validation only checks `all([result.scheme, result.netloc])`, then calls `driver.get(url)`.
- Impact: callers can direct the server browser toward loopback, private networks, and metadata services reachable from its container. With authentication unconfigured, any caller reaching the endpoint can attempt this.
- Verification: local validation accepted `http://127.0.0.1`, `http://169.254.169.254/latest/meta-data/`, and `ftp://example.com`. No internal service was contacted or exploited.
- Fix: allow only HTTP(S), reject credentials and prohibited destinations, and define whether internal captures are a supported requirement. Protect redirects and subresource fetches as well as the initial URL.
- Mitigation: enforce browser egress restrictions through a controlled proxy or network policy, including IPv6, DNS rebinding, redirects, and subresources. Initial hostname checks alone are insufficient.
- Uncertainty: production egress controls were not inspected; they could reduce exposure.

### 2. High — Authentication fails open

- Rule: secure production configuration / fail-closed authentication.
- Location: utilities.py:5–12; README Docker examples.
- Evidence: `if not BEARER_TOKEN: return None`.
- Impact: a missing environment variable silently exposes an expensive browser service to every reachable client.
- Verification: local request context with an unset configured token passed authentication.
- Fix: require a configured token at production startup; allow anonymous local use only through an explicit development option. Use constant-time token comparison.
- Mitigation: keep ingress authenticated while replacing the backend.
- Uncertainty: production token presence and proxy authentication were not inspected.

### 3. High — Untrusted browser runs without its sandbox

- Rule: isolate untrusted rendering workloads.
- Location: resources/screenshot.py:51; Dockerfile:32–97.
- Evidence: `--no-sandbox`; runtime image declares no non-root `USER`.
- Impact: a browser exploit has fewer isolation barriers and can execute as the container's default root user. This is a hardening weakness, not evidence of an existing browser exploit.
- Fix: run as an unprivileged user and enable the browser sandbox with a compatible runtime configuration. Keep rendering separate from application secrets and unrestricted network access.
- Mitigation: restrict container capabilities, filesystem writes, resources, mounts, and egress.
- Uncertainty: deployed runtime user and container hardening may override image defaults.

### 4. Medium — Request budgets and cleanup are incomplete

- Rule: resource limits and reliable cleanup.
- Location: resources/screenshot.py:33–35,42–45,55–59,61–88; gunicorn_config.py:2.
- Evidence: viewport permits nearly 100 million pixels; navigation permits 30 seconds plus 30 seconds of delay; two synchronous workers; browser timeout setup happens before the cleanup block. Empty temporary directories survive failures before a file is created.
- Impact: expensive requests can occupy both workers; failures can leak directories or browser processes. No app-level rate limiting or explicit admission control is present.
- Fix: cap total pixels, define a total capture deadline and capacity policy, reject overload predictably, and make browser and temporary-resource cleanup cover all failure paths.
- Mitigation: enforce container and ingress resource/rate limits. Align worker timeouts with the capture budget.
- Uncertainty: ingress rate limits and deployment resource limits were not inspected.

### 5. High advisory severity — Known vulnerable dependency pins

- Rule: FLASK-DEPS-001.
- Location: requirements.txt:6–7.
- Evidence: urllib3==2.4.0 and werkzeug==3.1.8; GitHub reports nine open alerts.
- Impact: affected upstream behaviors remain installed by a fresh build; exploitability varies by advisory and actual call path. Chrome performs page navigation, so urllib3 advisories must not automatically be described as exploitable by the target website.
- Fix: resolve a compatible dependency set incorporating the reported fixes, then exercise browser integration and API regression tests. Consolidate overlapping dependency PRs after a tested replacement is ready.
- Sources: [Dependabot alerts](https://github.com/RAHB-REALTORS-Association/selenium-screenshots/security/dependabot), especially #17–19 and #22–25.

## Functional and delivery defects

1. **Image responses are broken independently of security findings.** resources/screenshot.py:65,81 interpolate Python's built-in `format` instead of `img_format`. Local mocked captures returned `image/<built-in function format>` and `screenshot.built-in_function_format` for both PNG and JPG. Selenium's `save_screenshot` path produces PNG; this code contains no JPEG conversion.
2. **Cleanup occurs before the response is consumed.** resources/screenshot.py:85–88 unlink the file immediately after constructing a streaming response. An already-open file descriptor can work on Linux/macOS, but this relies on platform and response behavior. Return image bytes or manage lifetime explicitly.
3. **CI has no behavioral tests.** .github/workflows/python-app.yml:27–40 installs packages and runs linters, without exercising routes or a real browser. It missed the built-in `format` bug because that name is valid Python.
4. **The release bot condition misses Dependabot.** .github/workflows/dependabot-release.yml:13 tests the PR author's login against `github-actions[bot]`, while dependency PR authors are `dependabot[bot]`. Correcting this also requires reviewing token permissions and workflow-trigger behavior for bot-created tags.
5. **The explicit `latest` tag condition is unreachable.** .github/workflows/docker-image.yml:3–4 only handles `create`; line 41 enables the raw latest tag only for `push`. Docker metadata may independently produce a latest tag for semver releases; verify actual published tags rather than assuming latest is absent.
6. **The production webhook can report false success.** .github/workflows/docker-image.yml:62 uses curl without HTTP failure checking or a bounded timeout. Image publication is not verified application health.
7. **Browser builds are not reproducible.** Dockerfile:12–27 resolves latest ChromeDriver, line 36 downloads current Chrome independently, and line 54 downloads a font from a moving main branch. Preserve fonts, but pin compatible browser/driver versions and verify downloads. The runtime image is amd64-specific.
8. **No successful Docker runs were returned** by the query for the five latest successful runs of docker-image.yml. This does not prove the pipeline never worked; it means this review did not establish a successful recent delivery baseline.
9. **Credential persistence needs cleanup.** docs/client.js:17–18 prefers localStorage over sessionStorage; lines 168–175 write a new preference without clearing the previous store. Turning off persistence can leave the old token saved and selected after reload. Use memory/session storage by default and explicitly clear stale persistent values.
10. **The Docker context needs a Python-environment exclusion.** .dockerignore does not exclude `.venv` or bytecode caches, while Dockerfile:92 copies the entire context. A local build can include the developer environment; CI clean checkouts may avoid that particular problem.

## Concrete replacement scope

1. Establish contract tests for both route aliases, authentication, validation, PNG/JPEG signatures and MIME types, exact viewport dimensions, timeout handling, and failure cleanup. Keep an actual browser smoke test against a controlled fixture page.
2. Replace the handler with separate configuration, validation, capture, and response responsibilities. Flask can remain; remove Flask-RESTful if it adds no value. Selenium can remain initially. Evaluate Playwright only against demonstrated needs such as full-page capture and browser lifecycle management; switching engines does not solve SSRF or isolation by itself.
3. Require authentication, define destination policy, isolate browser egress, cap pixels and total time, and bound concurrent work. Start with a small synchronous service; introduce a queue only if observed load requires it.
4. Implement correct PNG/JPEG output and optional bounded full-page capture (#19). Preserve bearer headers; defer query-string secrets (#20), which would expose credentials to URL logging and history.
5. Resolve dependencies together, add meaningful CI, repair release/tag behavior, pin browser assets, retain the required fonts, and validate the complete container before deployment. Preserve GHCR and Coolify as the delivery model.
6. Refresh the small static client and API docs to match the implemented contract. Verify #15's deployed result before closing it. Triage obsolete PRs after replacement validation, without automatically merging or closing anything during assessment.

## Verification limits

Used the existing project `.venv/bin/python` (Python 3.11.8). Its installed Flask 3.0.0, Selenium 4.13.0, Werkzeug 3.0.0, and urllib3 2.0.6 differ from requirements.txt. No packages were installed or updated. Local checks used request contexts and a mocked driver; they establish source-level validation, auth, and response metadata behavior, not current pinned-dependency integration or real browser output.

Inspected tracked app/client/container/workflow sources and authenticated GitHub metadata, open issues, PR checks, alerts, and one failing CI log. Did not build Docker, contact production, test private network access, inspect deployment secrets, or verify private security reports. No known exploitation is claimed.

## Implementation verification update

The preceding assessment describes the original commit, not completion of the implementation. The working tree contains a partial replacement.

On 2026-10-28, the existing `.venv` (Python 3.11.8) was updated to requirements.txt successfully; `pip check` passed. Six unit tests passed against those dependencies. Installed macOS Google Chrome then produced real PNG and JPEG fixture captures using temporary Selenium profiles. PNG dimensions were verified as exactly 800×600 for viewport capture and 800×1800 for full-page capture; the viewport image was visually inspected. This checks capture code, not HTTP routing through a filtering proxy.

The Bookworm/Chromium image builds successfully on local arm64. Its default Docker seccomp policy blocks browser sandbox namespace creation; a network-isolated diagnostic with seccomp relaxed confirmed the cause. A Chromium-compatible Microsoft seccomp profile was vendored for inspection, but deployment using it has not been verified. Production proxy/network isolation, full browser/API integration, container runtime validation, reproducible browser/font assets, and release automation validation remain outstanding. No production deployment or GitHub mutation has occurred.
