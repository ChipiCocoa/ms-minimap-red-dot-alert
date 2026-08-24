import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../scripts/serve.js';

let server;
let origin;

before(async () => {
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('serves the app entry point', async () => {
  const response = await fetch(`${origin}/`);

  assert.equal(response.status, 200);
});

test('answers a malformed percent-escape with a status instead of crashing', async () => {
  const response = await fetch(`${origin}/%`);

  assert.equal(response.status, 400);
});

test('keeps serving after a malformed request', async () => {
  await fetch(`${origin}/%`).catch(() => {});

  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
});

test('refuses to serve files outside the project root', async () => {
  const response = await fetch(`${origin}/../../../etc/passwd`);

  assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`);
});
