import { Hono, type Context } from 'hono';
import {
    filterODataResult,
    selectODataResult,
    sortODataResult,
    toODataResponse,
    topODataResult
} from '../odata-helpers.ts';
import { journalEntryItems } from './journal-entry-data.ts';

export function journalEntryServiceDocument(context: Context) {
    return context.json({
        d: {
            EntitySets: ['A_JournalEntryItemBasic']
        }
    });
}

const journalEntryApi = new Hono();

journalEntryApi.get('/A_JournalEntryItemBasic', context => {
    const topEntries = topODataResult(journalEntryItems, context.req.query('$top'));
    const filteredEntries = filterODataResult(topEntries, context.req.query('$filter'));
    const sortedEntries = sortODataResult(filteredEntries, context.req.query('$orderby'));

    return toODataResponse(context, selectODataResult(sortedEntries, context.req.query('$select')));
});

journalEntryApi.get('/A_JournalEntryItemBasic/:id', context => {
    const entry = journalEntryItems.find(item => item.ID === context.req.param('id'));

    return entry ? toODataResponse(context, entry) : context.body(null, 404);
});

export default journalEntryApi;
