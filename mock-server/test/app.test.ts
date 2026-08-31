import assert from 'node:assert/strict';
import test from 'node:test';

import app from '../src/app.ts';

const servicePath = '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/';
const financialPlanningServicePath = '/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV/';
const journalEntryServicePath = '/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/';

test('serves the OData service document through the in-memory application', async () => {
    const response = await app.request(`http://localhost:3000${servicePath}`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-csrf-token'), 'dummyToken123');
    assert.equal(response.headers.get('set-cookie'), 'cookie');
    assert.deepEqual(await response.json(), {
        d: {
            EntitySets: [
                'A_PurchaseOrderItem',
                'A_PurchaseOrderScheduleLine',
                'A_PurchaseOrderItemNote'
            ]
        }
    });
});

test('returns a top-limited purchase-order entity set in an OData envelope', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItem?$top=1`
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json');

    const body = await response.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].PurchaseOrder, '4500000001');
    assert.equal(
        body.d.results[0].__metadata.uri,
        'http://localhost:3000/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem(PurchaseOrder=\'4500000001\',PurchaseOrderItem=\'10\')'
    );
});

test('filters purchase-order items with the OData filter query option', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItem?$filter=Plant%20eq%20%27DE01%27`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.ok(body.d.results.length > 0);
    assert.ok(body.d.results.every((item: { Plant: string }) => item.Plant === 'DE01'));
});

test('returns a purchase-order item by its composite key', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItem/4500000001/10`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.PurchaseOrder, '4500000001');
    assert.equal(body.d.PurchaseOrderItem, '10');
});

test('returns purchase-order schedule lines in an OData envelope', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderScheduleLine?$top=1`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].PurchasingDocument, '4500000001');
    assert.equal(body.d.results[0].ScheduleLineDeliveryDate, '/Date(1757216514641)/');
});

test('projects purchase-order items with the OData select query option', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItem?$top=1&$select=PurchaseOrder,Plant`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(Object.keys(body.d.results[0]).sort(), ['Plant', 'PurchaseOrder', '__metadata']);
    assert.equal(body.d.results[0].Plant, 'DE01');
});

test('returns purchase-order item notes in an OData envelope', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItemNote`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.ok(Array.isArray(body.d.results));
});

test('creates a purchase-order note with OData creation semantics', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItemNote`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                PurchaseOrder: '4500000001',
                PurchaseOrderItem: '10',
                PlainLongText: 'Escalation sent',
                Language: 'EN'
            })
        }
    );

    assert.equal(response.status, 201);
    assert.equal(
        response.headers.get('location'),
        "http://localhost:3000/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItemNote(PurchaseOrder='4500000001',PurchaseOrderItem='10',TextObjectType='F03',Language='EN')"
    );

    const body = await response.json();
    assert.equal(body.d.PlainLongText, 'Escalation sent');
    assert.equal(body.d.TextObjectType, 'F03');
});

test('defers unexpanded navigation properties in OData entity responses', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItem?$top=1`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(
        body.d.results[0].to_ScheduleLine.__deferred.uri,
        'http://localhost:3000/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem(PurchaseOrder=\'4500000001\',PurchaseOrderItem=\'10\')/to_ScheduleLine'
    );
});

test('orders purchase-order items with the OData orderby query option', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItem?$orderby=Plant%20desc`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.results[0].Plant, 'PT01');
});

test('returns an OData error for notes targeting an unknown purchase-order item', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItemNote`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                PurchaseOrder: '9999999999',
                PurchaseOrderItem: '10',
                PlainLongText: 'Escalation sent'
            })
        }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
        error: {
            code: 'INVALID_REQUEST',
            message: {
                lang: 'en',
                value: 'Cannot create note: Purchase order item with PurchaseOrder 9999999999 and PurchaseOrderItem 10 does not exist.'
            }
        }
    });
});

test('rejects malformed note payloads with a client error', async () => {
    const response = await app.request(
        `http://localhost:3000${servicePath}A_PurchaseOrderItemNote`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{'
        }
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
});

test('serves the financial planning OData service document', async () => {
    const response = await app.request(`http://localhost:3000${financialPlanningServicePath}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        d: {
            EntitySets: ['A_FinPlanningEntryItem']
        }
    });
});

test('returns financial planning entries in an OData collection', async () => {
    const response = await app.request(
        `http://localhost:3000${financialPlanningServicePath}A_FinPlanningEntryItem?$top=1`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].ID, 'FP-2026-001');
    assert.equal(body.d.results[0].CompanyCode, '1010');
    assert.equal(body.d.results[0].AmountInCompanyCodeCurrency, '125000.00');
});

test('serves the journal entry OData service document', async () => {
    const response = await app.request(`http://localhost:3000${journalEntryServicePath}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        d: {
            EntitySets: ['A_JournalEntryItemBasic']
        }
    });
});

test('returns journal entry items in an OData collection', async () => {
    const response = await app.request(
        `http://localhost:3000${journalEntryServicePath}A_JournalEntryItemBasic?$top=1`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].ID, 'JE-2026-001');
    assert.equal(body.d.results[0].CompanyCode, '1010');
    assert.equal(body.d.results[0].AmountInCompanyCodeCurrency, '-12500.00');
});

test('returns a financial planning entry by ID', async () => {
    const response = await app.request(
        `http://localhost:3000${financialPlanningServicePath}A_FinPlanningEntryItem/FP-2026-001`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.ID, 'FP-2026-001');
    assert.equal(body.d.PlanningCategory, 'BUDGET');
});

test('returns a journal entry item by ID', async () => {
    const response = await app.request(
        `http://localhost:3000${journalEntryServicePath}A_JournalEntryItemBasic/JE-2026-001`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.ID, 'JE-2026-001');
    assert.equal(body.d.BusinessTransactionCategory, 'RFBU');
});

test('projects financial planning entries with OData select', async () => {
    const response = await app.request(
        `http://localhost:3000${financialPlanningServicePath}A_FinPlanningEntryItem?$select=ID,CompanyCode`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(Object.keys(body.d.results[0]).sort(), ['CompanyCode', 'ID', '__metadata']);
});

test('filters financial planning entries by company code', async () => {
    const response = await app.request(
        `http://localhost:3000${financialPlanningServicePath}A_FinPlanningEntryItem?$filter=CompanyCode%20eq%20%271710%27`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].ID, 'FP-2026-002');
});

test('filters journal entry items by company code', async () => {
    const response = await app.request(
        `http://localhost:3000${journalEntryServicePath}A_JournalEntryItemBasic?$filter=CompanyCode%20eq%20%271710%27`
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].ID, 'JE-2026-002');
});
