import { type Context, Hono } from 'hono';
import { selectODataResult, toODataResponse } from '../odata-helpers.ts';
import { getJournalEntryById, queryJournalEntries } from '../shared/db.ts';

export function journalEntryServiceDocument(context: Context) {
  return context.json({
    d: {
      EntitySets: ['A_JournalEntryItemBasic'],
    },
  });
}

const journalEntryApi = new Hono();

journalEntryApi.get('/A_JournalEntryItemBasic', async (context) => {
  const rows = await queryJournalEntries({
    filter: context.req.query('$filter'),
    orderby: context.req.query('$orderby'),
    top: context.req.query('$top'),
  });

  return toODataResponse(
    context,
    selectODataResult(rows, context.req.query('$select')),
  );
});

journalEntryApi.get('/A_JournalEntryItemBasic/:id', async (context) => {
  const entry = await getJournalEntryById(context.req.param('id'));
  return entry ? toODataResponse(context, entry) : context.body(null, 404);
});

export default journalEntryApi;
