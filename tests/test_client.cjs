const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const context = { document: { addEventListener() {} }, Blob };
vm.createContext(context);
vm.runInContext(fs.readFileSync("docs/client.js", "utf8"), context);
test("authentication failures identify the API/key mismatch", async () => {
  assert.match(
    await context.screenshotErrorMessage({ response: { status: 401 } }),
    /HTTP 401:.*API key/,
  );
});
test("JSON errors wrapped in image Blobs are decoded", async () => {
  const data = new Blob([
    JSON.stringify({ message: "Invalid viewport dimensions" }),
  ]);
  assert.equal(
    await context.screenshotErrorMessage({ response: { status: 400, data } }),
    "HTTP 400: Invalid viewport dimensions",
  );
});
test("non-JSON proxy failures preserve the status", async () => {
  assert.match(
    await context.screenshotErrorMessage({
      response: { status: 502, data: new Blob(["<html>Bad Gateway</html>"]) },
    }),
    /HTTP 502:/,
  );
});
test("network errors identify connectivity and CORS", async () => {
  assert.match(await context.screenshotErrorMessage({}), /network, and CORS/);
});

function serviceWorker(overrides = {}) {
  const handlers = {};
  const worker = {
    self: {
      location: { origin: "https://screenshots.example" },
      addEventListener: (name, fn) => (handlers[name] = fn),
    },
    URL,
    console,
    ...overrides,
  };
  vm.runInNewContext(fs.readFileSync("docs/service-worker.js", "utf8"), worker);
  return { handlers, worker };
}
test("service worker gets fresh pages/scripts/styles and falls back only while offline", async () => {
  let offline = false;
  const { handlers } = serviceWorker({
    fetch: async () => {
      if (offline) throw Error("offline");
      return "fresh page";
    },
    caches: { match: async () => "offline page" },
  });
  for (const destination of ["document", "script", "style"]) {
    const request = {
      method: "GET",
      mode: destination === "document" ? "navigate" : "cors",
      destination,
      url: "https://screenshots.example/",
      headers: new Headers(),
    };
    let response;
    offline = false;
    handlers.fetch({ request, respondWith: (value) => (response = value) });
    assert.equal(await response, "fresh page");
    offline = true;
    handlers.fetch({ request, respondWith: (value) => (response = value) });
    assert.equal(await response, "offline page");
  }
});
test("service worker leaves credentialed and cross-origin requests alone", () => {
  const { handlers } = serviceWorker();
  const intercept = () => assert.fail("Sensitive request intercepted by cache");
  handlers.fetch({
    request: {
      method: "GET",
      url: "https://api.example/screenshot",
      headers: new Headers(),
    },
    respondWith: intercept,
  });
  handlers.fetch({
    request: {
      method: "GET",
      url: "https://screenshots.example/screenshot",
      headers: new Headers({ Authorization: "Bearer test" }),
    },
    respondWith: intercept,
  });
});

Object.assign(context, { URL, URLSearchParams });
const options = {
  url: "https://example.com/path?a=1&b=2",
  viewport: "800x600",
  format: "PNG",
  delay: "1",
  fullpage: true,
};
test("full-page request encodes the target and keeps the token exclusively in the header", () => {
  const request = context.captureRequest(
    "https://api.example/base/",
    "test-only",
    options,
  );
  const url = new URL(request.url);
  assert.equal(url.pathname, "/base/screenshot");
  assert.equal(url.searchParams.get("url"), options.url);
  assert.equal(url.searchParams.get("fullpage"), "1");
  assert.equal(request.headers.Authorization, "Bearer test-only");
  assert.ok(!request.url.includes("test-only"));
  assert.equal(
    new URL(
      context.captureRequest("https://api.example", "test", {
        ...options,
        fullpage: false,
      }).url,
    ).searchParams.get("fullpage"),
    "0",
  );
});
test("invalid endpoints, credentials and oversized viewports are rejected before fetch", () => {
  for (const endpoint of [
    "javascript:alert(1)",
    "https://user:pass@api.example",
    "https://api.example?secret_key=test",
    "https://api.example/#fragment",
  ]) {
    assert.throws(() => context.captureRequest(endpoint, "test", options));
  }
  for (const viewport of ["0x600", "9999x9999", "10000x600", "wat"]) {
    assert.throws(() =>
      context.captureRequest("https://api.example", "test", {
        ...options,
        viewport,
      }),
    );
  }
  assert.throws(
    () => context.captureRequest("https://api.example", "", options),
    /API key/,
  );
  assert.throws(() =>
    context.captureRequest("https://api.example", "test", {
      ...options,
      url: "file:///etc/passwd",
    }),
  );
});
function store(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test("existing remembered and session API settings survive the interface upgrade", () => {
  for (const remember of [false, true]) {
    const local = store(
      remember ? { apiUrl: "https://custom.example", apiKey: "legacy" } : {},
    );
    const session = store(
      remember ? {} : { apiUrl: "https://custom.example", apiKey: "legacy" },
    );
    const loaded = context.readSettings(local, session);
    assert.equal(loaded.key, "legacy");
    assert.equal(loaded.url, "https://custom.example");
    assert.equal(loaded.remember, remember);
    context.persistSettings(local, session, { ...loaded, remember: !remember });
    assert.equal(context.readSettings(local, session).key, "legacy");
    assert.equal((remember ? local : session).getItem("apiKey"), null);
  }
});
test("failed storage write does not clear the existing key", () => {
  const local = store({ apiKey: "existing" });
  const session = {
    setItem() {
      throw Error("blocked");
    },
  };
  assert.throws(
    () =>
      context.persistSettings(local, session, {
        url: "https://api.example",
        key: "next",
        remember: false,
      }),
    /blocked/,
  );
  assert.equal(local.getItem("apiKey"), "existing");
});
test("download filename uses the captured format and UTC timestamp", () => {
  assert.equal(
    context.captureFilename("JPG", new Date("2026-10-29T13:20:30Z")),
    "screenshot-20261029-132030.jpg",
  );
});

test("endpoint and credential are committed together when overwriting a connection", () => {
  const local = store({ apiUrl: "https://old.example", apiKey: "existing" });
  const original = local.setItem;
  local.setItem = () => {
    throw Error("quota");
  };
  assert.throws(() =>
    context.persistSettings(local, store(), {
      url: "https://new.example",
      key: "new",
      remember: true,
    }),
  );
  assert.equal(context.readSettings(local, store()).url, "https://old.example");
  assert.equal(context.readSettings(local, store()).key, "existing");
  local.setItem = original;
  context.persistSettings(local, store(), {
    url: "https://new.example",
    key: "new",
    remember: true,
  });
  assert.equal(context.readSettings(local, store()).url, "https://new.example");
  assert.equal(context.readSettings(local, store()).key, "new");
});
