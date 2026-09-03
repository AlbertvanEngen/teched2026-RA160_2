import { createServer as createHttpServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import app from './app.ts';

const PORT = Number(process.env.PORT ?? 3142);
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
	const vite = await createViteServer({
		server: { middlewareMode: true },
		appType: 'spa',
	});

	const honoListener = getRequestListener(app.fetch);

	const server = createHttpServer((req, res) => {
		const url = req.url ?? '/';
		// Route API and OData paths to Hono, everything else to Vite
		if (url.startsWith('/api/') || url.startsWith('/sap/')) {
			honoListener(req, res);
		} else {
			vite.middlewares(req, res);
		}
	});

	server.listen(PORT, () => {
		console.log(`Dev server on http://localhost:${PORT}`);
	});
} else {
	const { serve } = await import('@hono/node-server');
	serve({ fetch: app.fetch, port: PORT }, (info) => {
		console.log(`Server listening on http://localhost:${info.port}`);
	});
}
