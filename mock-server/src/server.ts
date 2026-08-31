import { serve } from '@hono/node-server';
import app from './app.ts';
import { createLogger } from '@sap-cloud-sdk/util';

const logger = createLogger('server');
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

serve({ fetch: app.fetch, port }, info => {
    logger.info(`Mock server started on port ${info.port}`);
});
