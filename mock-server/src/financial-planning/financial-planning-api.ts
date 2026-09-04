import { type Context, Hono } from 'hono';
import { selectODataResult, toODataResponse } from '../odata-helpers.ts';
import { getPlanningEntryById, queryPlanningEntries } from '../shared/db.ts';

export function financialPlanningServiceDocument(context: Context) {
  return context.json({
    d: {
      EntitySets: ['A_FinPlanningEntryItem'],
    },
  });
}

const financialPlanningApi = new Hono();

financialPlanningApi.get('/A_FinPlanningEntryItem', async (context) => {
  const rows = await queryPlanningEntries({
    filter: context.req.query('$filter'),
    orderby: context.req.query('$orderby'),
    top: context.req.query('$top'),
  });

  return toODataResponse(
    context,
    selectODataResult(rows, context.req.query('$select')),
  );
});

financialPlanningApi.get('/A_FinPlanningEntryItem/:id', async (context) => {
  const entry = await getPlanningEntryById(context.req.param('id'));
  return entry ? toODataResponse(context, entry) : context.body(null, 404);
});

export default financialPlanningApi;
