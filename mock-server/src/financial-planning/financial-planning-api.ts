import { Hono, type Context } from 'hono';
import {
    filterODataResult,
    selectODataResult,
    sortODataResult,
    toODataResponse,
    topODataResult
} from '../odata-helpers.ts';
import { financialPlanningEntries } from './financial-planning-data.ts';

export function financialPlanningServiceDocument(context: Context) {
    return context.json({
        d: {
            EntitySets: ['A_FinPlanningEntryItem']
        }
    });
}

const financialPlanningApi = new Hono();

financialPlanningApi.get('/A_FinPlanningEntryItem', context => {
    const topEntries = topODataResult(financialPlanningEntries, context.req.query('$top'));
    const filteredEntries = filterODataResult(topEntries, context.req.query('$filter'));
    const sortedEntries = sortODataResult(filteredEntries, context.req.query('$orderby'));

    return toODataResponse(context, selectODataResult(sortedEntries, context.req.query('$select')));
});

financialPlanningApi.get('/A_FinPlanningEntryItem/:id', context => {
    const entry = financialPlanningEntries.find(item => item.ID === context.req.param('id'));

    return entry ? toODataResponse(context, entry) : context.body(null, 404);
});

export default financialPlanningApi;
