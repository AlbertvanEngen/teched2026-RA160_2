import { Hono } from 'hono';
import {
    expandODataResult,
    filterODataResult,
    selectODataResult,
    sortODataResult,
    toODataResponse,
    topODataResult
} from '../odata-helpers.ts';
import {
    createPurchaseOrderItemNote,
    findPurchaseOrderItem,
    getAllPurchaseOrderItemNotes,
    getPurchaseOrderItems,
    getScheduleLineItems
} from './purchase-order-model.ts';
import { createLogger } from '@sap-cloud-sdk/util';

const logger = createLogger('purchase-order-api');
const purchaseOrderApi = new Hono();
purchaseOrderApi.get('/A_PurchaseOrderItem', context => {
    logger.debug('Reading purchase order item entity set');
    const topItems = topODataResult(getPurchaseOrderItems(), context.req.query('$top'));
    const expandedItems = expandODataResult(topItems, context.req.query('$expand'));
    const filteredItems = filterODataResult(expandedItems, context.req.query('$filter'));
    const sortedItems = sortODataResult(filteredItems, context.req.query('$orderby'));
    const selectedItems = selectODataResult(sortedItems, context.req.query('$select'));

    return toODataResponse(context, selectedItems);
});

purchaseOrderApi.get('/A_PurchaseOrderItem/:purchaseOrder/:item', context => {
    const item = findPurchaseOrderItem(context.req.param('purchaseOrder'), context.req.param('item'));

    if (!item) {
        return context.body(null, 404);
    }

    return toODataResponse(context, item);
});

purchaseOrderApi.get('/A_PurchaseOrderScheduleLine', context => {
    const items = topODataResult(getScheduleLineItems(), context.req.query('$top'));

    return toODataResponse(context, items);
});

purchaseOrderApi.get('/A_PurchaseOrderItemNote', context => {
    return toODataResponse(context, getAllPurchaseOrderItemNotes());
});

purchaseOrderApi.post('/A_PurchaseOrderItemNote', async context => {

    try {
        const noteData = await context.req.json();
        const note = createPurchaseOrderItemNote(noteData.PurchaseOrder, noteData.PurchaseOrderItem, noteData);
        const location = note.__metadata.uri.replace(/https:\/\/\{host\}:\{port\}/, new URL(context.req.url).origin);

        return toODataResponse(context, note, 201, { Location: location });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Invalid request';
        logger.error(`Error creating purchase order item note: ${message}`);

        return context.json({
            error: {
                code: 'INVALID_REQUEST',
                message: {
                    lang: 'en',
                    value: message
                }
            }
        }, 400);
    }
});

export default purchaseOrderApi;
