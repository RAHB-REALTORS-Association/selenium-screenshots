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
