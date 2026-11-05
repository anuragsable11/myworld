/*
 * World Atlas service worker: makes the app installable and usable offline.
 *
 * - The app itself (HTML, scripts, styles, fonts, map data, icons) is precached at install time.
 *   The build (vite.config.ts) fills in the precache manifest below: every file in the build with
 *   a content hash, so an update only downloads the files that changed. The previous version's
 *   files are kept until the next update, so a page still running it can load what it needs.
 * - Country details from open sources are cached as they are viewed, so countries you have
 *   opened before still work without a connection. So are the last 150 photo thumbnails.
 * - REST Countries API responses are never stored here: the app keeps those in localStorage for
 *   at most three days, as its terms allow. Their flag images follow the same three-day limit.
 */

const PRECACHE = 'atlas-precache';
const SHELL_URL = new URL('./', self.registration.scope).href;
/** Where the precache keys of the version that activated last are written down. */
const KEYS_URL = new URL('./__precache-keys', self.registration.scope).href;
const DAY_MS = 24 * 60 * 60 * 1000;

/** URL of each precached file → its cache key, which carries the file's revision. */
const precached = new Map(
  self.__PRECACHE_MANIFEST.map(({ url, revision }) => {
    const href = new URL(url, self.registration.scope).href;
    return [href, `${href}?__rev=${revision}`];
  }),
);

/** Third-party sources, in the order they are matched. */
const ROUTES = [
  {
    // CIA World Factbook profiles and the open countries dataset change rarely: answer from the
    // cache straight away and refresh it in the background.
    test: (url) =>
      (url.hostname === 'cdn.jsdelivr.net' && /^\/gh\/(factbook|mledoze)\//.test(url.pathname)) ||
      (url.hostname === 'raw.githubusercontent.com' && /^\/(factbook|mledoze)\//.test(url.pathname)),
    strategy: 'stale-while-revalidate',
    cache: 'atlas-open-data',
    maxEntries: 300,
  },
  {
    test: (url) => url.hostname === 'api.worldbank.org',
    strategy: 'stale-while-revalidate',
    cache: 'atlas-worldbank',
    maxEntries: 300,
  },
  {
    // Article summaries, the photos each article uses, and photo credits.
    test: (url) =>
      url.hostname === 'en.wikipedia.org' &&
      (/^\/api\/rest_v1\/page\/(summary|media-list)\//.test(url.pathname) || url.pathname === '/w/api.php'),
    strategy: 'stale-while-revalidate',
    cache: 'atlas-wikipedia',
    maxEntries: 300,
  },
  {
    // Photo thumbnails from Wikimedia Commons, requested in CORS mode so they're stored at their
    // real size. Bigger versions opened in the photo viewer aren't kept.
    test: (url) =>
      (url.hostname === 'thumb.wikimedia.org' || url.hostname === 'upload.wikimedia.org') &&
      /\/thumb\/.*\/([1-9]\d?|[1-4]\d\d|500)px-[^/]+$/.test(url.pathname),
    strategy: 'cache-first',
    cache: 'atlas-photos',
    maxEntries: 150,
    maxAgeMs: 30 * DAY_MS,
  },
  {
    // Heads of state and government change, so prefer the network and fall back to the cache.
    test: (url) => url.hostname === 'query.wikidata.org',
    strategy: 'network-first',
    cache: 'atlas-wikidata',
    maxEntries: 300,
    timeoutMs: 6000,
  },
  {
    // Large flags, shown for the selected country. The CDN doesn't send CORS headers, so these
    // are opaque responses, which browsers count as several MB each: keep only a few.
    test: (url) => url.hostname === 'flags.restcountries.com' && url.pathname.includes('/svg/'),
    strategy: 'cache-first',
    cache: 'atlas-flags',
    maxEntries: 24,
    maxAgeMs: 3 * DAY_MS,
  },
];

const CACHES = new Set([PRECACHE, ...ROUTES.map((r) => r.cache)]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      const stored = new Set((await cache.keys()).map((request) => request.url));
      await Promise.all(
        [...precached]
          .filter(([, key]) => !stored.has(key))
          .map(async ([href, key]) => {
            const res = await fetch(href, { cache: 'reload' });
            if (!res.ok) throw new Error(`Could not precache ${href}: ${res.status}`);
            await cache.put(key, await followed(res));
          }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep this version's files and the previous version's, for pages still running it.
      const current = new Set(precached.values());
      const cache = await caches.open(PRECACHE);
      const listed = await cache.match(KEYS_URL);
      const previous = new Set(listed ? await listed.json().catch(() => []) : []);
      for (const request of await cache.keys()) {
        if (request.url !== KEYS_URL && !current.has(request.url) && !previous.has(request.url)) await cache.delete(request);
      }
      await cache.put(KEYS_URL, new Response(JSON.stringify([...current]), { headers: { 'Content-Type': 'application/json' } }));
      for (const name of await caches.keys()) if (name.startsWith('atlas-') && !CACHES.has(name)) await caches.delete(name);
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(navigate(event));
    return;
  }
  if (url.origin === self.location.origin) {
    const key = precached.get(url.href);
    if (key) event.respondWith(fromPrecache(key, request));
    // A file of the previous version, for a page that's still running it.
    else if (url.pathname.includes('/assets/')) event.respondWith(fromPreviousVersion(request));
    return;
  }
  const route = ROUTES.find((r) => r.test(url));
  if (route) event.respondWith(handle(route, event));
});

self.addEventListener('message', (event) => {
  // Is the page that asks running this version? (See registerServiceWorker in src/lib/pwa.ts.)
  if (event.data?.type === 'is-current') {
    event.ports[0]?.postMessage(precached.has(event.data.url));
    return;
  }
  // Data the page fetched before this worker took over.
  if (event.data?.type !== 'cache-urls' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    Promise.all(
      event.data.urls.map(async (href) => {
        const route = ROUTES.find((r) => r.strategy !== 'cache-first' && r.test(new URL(href)));
        if (!route) return;
        const cache = await caches.open(route.cache);
        if (await cache.match(href, { ignoreVary: true })) return;
        try {
          const res = await fetch(href);
          if (res.ok) await cache.put(href, res);
        } catch {
          // Offline again already; it will be cached the next time it's used.
        }
      }),
    ),
  );
});

/** Pages come from the network so a new version shows up at once; the precached app is the fallback. */
async function navigate(event) {
  try {
    const network = (async () => (await event.preloadResponse) ?? (await fetch(event.request)))();
    return await withTimeout(network, 4000);
  } catch {
    const shell = precached.get(SHELL_URL);
    return (shell && (await caches.match(shell, { cacheName: PRECACHE }))) ?? Response.error();
  }
}

async function fromPrecache(key, request) {
  return (await caches.match(key, { cacheName: PRECACHE })) ?? fetch(request);
}

async function fromPreviousVersion(request) {
  const cache = await caches.open(PRECACHE);
  return (await cache.match(request.url, { ignoreSearch: true })) ?? fetch(request);
}

async function handle(route, event) {
  const cache = await caches.open(route.cache);
  const { request } = event;

  if (route.strategy === 'cache-first') {
    // The time a response was stored is kept in its cache key's query string.
    const [key] = await cache.keys(request, { ignoreSearch: true });
    const storedAt = key ? Number(new URL(key.url).searchParams.get('stored')) : 0;
    const hit = key && Date.now() - storedAt < route.maxAgeMs ? await cache.match(key) : undefined;
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        event.waitUntil(
          (async () => {
            await cache.delete(request, { ignoreSearch: true });
            const stamped = new URL(request.url);
            stamped.searchParams.set('stored', String(Date.now()));
            await cache.put(stamped.href, copy);
            await trim(cache, route.maxEntries);
          })(),
        );
      }
      return res;
    } catch (err) {
      if (key) await cache.delete(request, { ignoreSearch: true }); // too old to show
      throw err;
    }
  }

  // The app always sends the same headers for a URL, so a stored response fits whatever it varies on.
  const cached = await cache.match(request, { ignoreVary: true });
  const network = fetch(request).then((res) => {
    if (res.ok) event.waitUntil(cache.put(request, res.clone()).then(() => trim(cache, route.maxEntries)));
    return res;
  });

  if (route.strategy === 'stale-while-revalidate') {
    if (!cached) return network;
    event.waitUntil(network.catch(() => {}));
    return cached;
  }

  // network-first
  if (!cached) return network;
  try {
    const res = await withTimeout(network, route.timeoutMs);
    return res.ok ? res : cached;
  } catch {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
}

/** Drops the oldest entries; keys come back in the order they were stored. */
async function trim(cache, maxEntries) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(key);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Browsers refuse redirected responses for navigations, so store a plain copy instead. */
async function followed(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}
