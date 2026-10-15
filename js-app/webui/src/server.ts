import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT ?? 3142);
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Watch sibling workspace packages so edits in agent or mock-server trigger SSR reloads
  vite.watcher.add([
    path.resolve(import.meta.dirname, '../../agent/src'),
    path.resolve(import.meta.dirname, '../../../mock-server/src'),
  ]);

  let cachedApp: unknown = null;
  let cachedListener: ReturnType<typeof getRequestListener> | null = null;

  async function getListener() {
    const mod = (await vite.ssrLoadModule('/src/app.ts')) as {
      default: { fetch: Parameters<typeof getRequestListener>[0] };
    };
    if (mod !== cachedApp || !cachedListener) {
      cachedApp = mod;
      cachedListener = getRequestListener(mod.default.fetch);
    }
    return cachedListener;
  }

  const server = createHttpServer(async (req, res) => {
    const url = req.url ?? '/';
    // Route API and OData paths to Hono, everything else to Vite
    if (url.startsWith('/api/') || url.startsWith('/sap/')) {
      try {
        const listener = await getListener();
        listener(req, res);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        console.error('[Hono SSR Error]', err);
        res.statusCode = 500;
        res.end((err as Error).stack ?? String(err));
      }
    } else {
      vite.middlewares(req, res);
    }
  });

  server.listen(PORT, () => {
    console.log(`Dev server on http://localhost:${PORT}`);
  });
} else {
  const { default: app } = await import('./app.ts');
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
  });
}
