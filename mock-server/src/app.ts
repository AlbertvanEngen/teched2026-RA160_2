import { Hono, type Context } from 'hono';
import { createLogger } from '@sap-cloud-sdk/util';
import purchaseOrderApi from './purchase-order/purchase-order-api.ts';
import financialPlanningApi, { financialPlanningServiceDocument } from './financial-planning/financial-planning-api.ts';
import journalEntryApi, { journalEntryServiceDocument } from './journal-entry/journal-entry-api.ts';

const servicePath = '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV';
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
        <title>OData Mock Service for Purchase Order API of SAP S/4HANA Cloud</title>
    </head>
    <body>
        <div>OData mock service for Purchase Order API is running at <a href="${servicePath}">${servicePath}</a>.</div>
    </body>
</html>`));

function serviceDocument(context: Context) {
    return context.json({
        d: {
            EntitySets: [
                'A_PurchaseOrderItem',
                'A_PurchaseOrderScheduleLine',
                'A_PurchaseOrderItemNote'
            ]
        }
    });
}

app.get(servicePath, serviceDocument);
app.get(`${servicePath}/`, serviceDocument);

app.route(servicePath, purchaseOrderApi);

app.get(financialPlanningServicePath, financialPlanningServiceDocument);
app.get(`${financialPlanningServicePath}/`, financialPlanningServiceDocument);
app.route(financialPlanningServicePath, financialPlanningApi);

app.get(journalEntryServicePath, journalEntryServiceDocument);
app.get(`${journalEntryServicePath}/`, journalEntryServiceDocument);
app.route(journalEntryServicePath, journalEntryApi);

export default app;
