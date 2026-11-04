import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Store screenshots are only shown by the browser's install dialog, so they aren't kept offline.
const NOT_PRECACHED = /^(screenshots\/|\.vite\/)|\.map$/;
const PLACEHOLDER = 'self.__PRECACHE_MANIFEST';

/**
 * Emits the service worker (src/sw.js) with a precache list of every file in the build — the
 * bundles plus everything copied from public/ — each with a content hash, so that an update only
 * re-downloads the files that changed.
 */
function serviceWorker(): Plugin {
  let root = '';
  let publicDir = '';
  return {
    name: 'atlas:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    generateBundle(_, bundle) {
      const files = new Map<string, string | Uint8Array>();
      if (publicDir) {
        for (const file of listFiles(publicDir)) files.set(relative(publicDir, file).replaceAll('\\', '/'), readFileSync(file));
      }
      for (const out of Object.values(bundle)) files.set(out.fileName, out.type === 'chunk' ? out.code : out.source);

      const manifest = [...files]
        .filter(([name]) => !NOT_PRECACHED.test(name))
        .map(([name, data]) => ({
          // The page is cached under the app's root URL, which is what the browser navigates to.
          url: name === 'index.html' ? './' : name,
          revision: createHash('sha256').update(data).digest('hex').slice(0, 12),
        }));
      const parts = readFileSync(resolve(root, 'src/sw.js'), 'utf8').split(PLACEHOLDER);
      if (parts.length !== 2) this.error(`src/sw.js must contain ${PLACEHOLDER} exactly once`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: parts.join(JSON.stringify(manifest)) });
    },
  };
}

function* listFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* listFiles(path);
    else yield path;
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/d3-') || id.includes('node_modules/topojson')) return 'geo';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
});
