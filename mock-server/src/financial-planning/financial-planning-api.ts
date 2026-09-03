import { type Context, Hono } from "hono";
import {
	filterODataResult,
	selectODataResult,
	sortODataResult,
	toODataResponse,
	topODataResult,
} from "../odata-helpers.ts";
import { getFinancialPlanningEntries } from "./financial-planning-data.ts";

export function financialPlanningServiceDocument(context: Context) {
	return context.json({
		d: {
			EntitySets: ["A_FinPlanningEntryItem"],
		},
	});
}

const financialPlanningApi = new Hono();

financialPlanningApi.get("/A_FinPlanningEntryItem", (context) => {
	const financialPlanningEntries = getFinancialPlanningEntries();
	const filteredEntries = filterODataResult(
		financialPlanningEntries,
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

financialPlanningApi.get("/A_FinPlanningEntryItem/:id", (context) => {
	const financialPlanningEntries = getFinancialPlanningEntries();
	const entry = financialPlanningEntries.find(
		(item) => item.ID === context.req.param("id"),
	);

	return entry ? toODataResponse(context, entry) : context.body(null, 404);
});

export default financialPlanningApi;
