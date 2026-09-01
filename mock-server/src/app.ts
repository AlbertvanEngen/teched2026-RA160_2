import { Hono } from 'hono';
import { createLogger } from '@sap-cloud-sdk/util';
import financialPlanningApi, { financialPlanningServiceDocument } from './financial-planning/financial-planning-api.ts';
import journalEntryApi, { journalEntryServiceDocument } from './journal-entry/journal-entry-api.ts';

const financialPlanningServicePath = '/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV';
const journalEntryServicePath = '/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';
const logger = createLogger('server');
const app = new Hono();

app.use('*', async (context, next) => {
    logger.info(`Request: ${context.req.method} ${context.req.path}`);
    context.header('x-csrf-token', 'dummyToken123');
    context.header('set-cookie', 'cookie');
    await next();
});

app.get('/', context => context.html(`<html>
    <head>
        <title>OData Mock Service</title>
    </head>
    <body>
        <div>OData mock services are running.</div>
    </body>
</html>`));

app.get(financialPlanningServicePath, financialPlanningServiceDocument);
app.get(`${financialPlanningServicePath}/`, financialPlanningServiceDocument);
app.route(financialPlanningServicePath, financialPlanningApi);

app.get(journalEntryServicePath, journalEntryServiceDocument);
app.get(`${journalEntryServicePath}/`, journalEntryServiceDocument);
app.route(journalEntryServicePath, journalEntryApi);

export default app;
