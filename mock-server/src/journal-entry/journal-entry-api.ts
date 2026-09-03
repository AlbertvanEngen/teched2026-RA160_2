import { type Context, Hono } from "hono";
import {
	filterODataResult,
	selectODataResult,
	sortODataResult,
	toODataResponse,
	topODataResult,
} from "../odata-helpers.ts";
import { getJournalEntryItems } from "./journal-entry-data.ts";

export function journalEntryServiceDocument(context: Context) {
	return context.json({
		d: {
			EntitySets: ["A_JournalEntryItemBasic"],
		},
	});
}

const journalEntryApi = new Hono();

journalEntryApi.get("/A_JournalEntryItemBasic", (context) => {
	const journalEntryItems = getJournalEntryItems();
	const filteredEntries = filterODataResult(
		journalEntryItems,
		context.req.query("$filter"),
	);
	const sortedEntries = sortODataResult(
		filteredEntries,
		context.req.query("$orderby"),
	);
	const topEntries = topODataResult(sortedEntries, context.req.query("$top"));

	return toODataResponse(
		context,
		selectODataResult(topEntries, context.req.query("$select")),
	);
});

journalEntryApi.get("/A_JournalEntryItemBasic/:id", (context) => {
	const journalEntryItems = getJournalEntryItems();
	const entry = journalEntryItems.find(
		(item) => item.ID === context.req.param("id"),
	);

	return entry ? toODataResponse(context, entry) : context.body(null, 404);
});

export default journalEntryApi;
