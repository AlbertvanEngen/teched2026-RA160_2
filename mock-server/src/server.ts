import { serve } from '@hono/node-server';
import { createLogger } from '@sap-cloud-sdk/util';
import app from './app.ts';

const logger = createLogger('server');
const port = Number.parseInt(process.env.PORT ?? '3141', 10);

serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Mock server started on port ${info.port}`);
});
