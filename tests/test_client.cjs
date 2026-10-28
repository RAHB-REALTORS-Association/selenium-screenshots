const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = {document: {addEventListener() {}}, Blob};
vm.createContext(context);
vm.runInContext(fs.readFileSync('docs/client.js', 'utf8'), context);
test('authentication failures identify the API/key mismatch', async () => {
  assert.match(await context.screenshotErrorMessage({response: {status: 401}}), /HTTP 401:.*API key/);
});
test('JSON errors wrapped in image Blobs are decoded', async () => {
  const data = new Blob([JSON.stringify({message: 'Invalid viewport dimensions'})]);
  assert.equal(await context.screenshotErrorMessage({response: {status: 400, data}}), 'HTTP 400: Invalid viewport dimensions');
});
test('non-JSON proxy failures preserve the status', async () => {
  assert.match(await context.screenshotErrorMessage({response: {status: 502, data: new Blob(['<html>Bad Gateway</html>'])}}), /HTTP 502:/);
});
test('network errors identify connectivity and CORS', async () => {
  assert.match(await context.screenshotErrorMessage({}), /network, and CORS/);
});

function serviceWorker(overrides = {}) {
  const handlers = {};
  const worker = {
    self: {location: {origin: 'https://screenshots.example'}, addEventListener: (name, fn) => handlers[name] = fn},
    URL, console, ...overrides
  };
  vm.runInNewContext(fs.readFileSync('docs/service-worker.js', 'utf8'), worker);
  return {handlers, worker};
}
test('service worker gets fresh navigation and falls back only while offline', async () => {
  let offline = false;
  const {handlers} = serviceWorker({
    fetch: async () => { if (offline) throw Error('offline'); return 'fresh page'; },
    caches: {match: async () => 'offline page'}
  });
  const request = {method: 'GET', mode: 'navigate', url: 'https://screenshots.example/', headers: new Headers()};
  let response;
  handlers.fetch({request, respondWith: value => response = value});
  assert.equal(await response, 'fresh page');
  offline = true;
  handlers.fetch({request, respondWith: value => response = value});
  assert.equal(await response, 'offline page');
});
test('service worker leaves credentialed and cross-origin requests alone', () => {
  const {handlers} = serviceWorker();
  const intercept = () => assert.fail('Sensitive request intercepted by cache');
  handlers.fetch({request: {method: 'GET', url: 'https://api.example/screenshot', headers: new Headers()}, respondWith: intercept});
  handlers.fetch({request: {method: 'GET', url: 'https://screenshots.example/screenshot', headers: new Headers({Authorization: 'Bearer test'})}, respondWith: intercept});
});
