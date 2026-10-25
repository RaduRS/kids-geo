import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function worker({ offline = false, ok = true } = {}) {
  const handlers = {};
  const entries = new Map([['https://geo.test/maps/world.svg', new Response('old map')]]);
  const cache = {
    addAll: async () => {},
    match: async (request) => entries.get(request.url ?? request)?.clone(),
    put: async (request, response) => entries.set(request.url ?? request, response),
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: { location: { origin: 'https://geo.test' }, addEventListener: (name, fn) => handlers[name] = fn,
      skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, match: cache.match, keys: async () => [], delete: async () => {} },
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('new map', { status: ok ? 200 : 500 }); },
  });
  return async () => {
    let response;
    const pending = [];
    handlers.fetch({ request: { url: 'https://geo.test/maps/world.svg', method: 'GET', mode: 'cors' },
      respondWith: (value) => response = value, waitUntil: (value) => pending.push(value) });
    const result = await response;
    await Promise.all(pending);
    return { result, entries };
  };
}

test('an online visit replaces stale unversioned assets', async () => {
  const { result, entries } = await worker()();
  assert.equal(await result.text(), 'new map');
  assert.equal(await entries.get('https://geo.test/maps/world.svg').text(), 'new map');
});

test('cached assets remain available offline', async () => {
  const { result } = await worker({ offline: true })() ;
  assert.equal(await result.text(), 'old map');
});

test('failed responses do not overwrite a working offline asset', async () => {
  const { entries } = await worker({ ok: false })();
  assert.equal(await entries.get('https://geo.test/maps/world.svg').text(), 'old map');
});
