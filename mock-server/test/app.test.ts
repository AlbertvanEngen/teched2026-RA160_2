import assert from "node:assert/strict";
import test from "node:test";

import app from "../src/app.ts";

const financialPlanningServicePath =
	"/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV/";
const journalEntryServicePath =
	"/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/";

test("serves the financial planning OData service document", async () => {
	const response = await app.request(
		`http://localhost:3141${financialPlanningServicePath}`,
	);

	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-csrf-token"), "dummyToken123");
	assert.equal(response.headers.get("set-cookie"), "cookie");
	assert.deepEqual(await response.json(), {
		d: {
			EntitySets: ["A_FinPlanningEntryItem"],
		},
	});
});

test("serves the journal entry OData service document", async () => {
	const response = await app.request(
		`http://localhost:3141${journalEntryServicePath}`,
	);

	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		d: {
			EntitySets: ["A_JournalEntryItemBasic"],
		},
	});
});

test("returns financial planning entries in an OData collection", async () => {
	const response = await app.request(
		`http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem?$top=5`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.equal(body.d.results.length, 5);
	assert.ok(body.d.results[0].ID);
	assert.ok(body.d.results[0].CompanyCode);
	assert.ok(body.d.results[0].AmountInCompanyCodeCurrency);
});

test("returns journal entry items in an OData collection", async () => {
	const response = await app.request(
		`http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic?$top=5`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.equal(body.d.results.length, 5);
	assert.ok(body.d.results[0].ID);
	assert.ok(body.d.results[0].CompanyCode);
	assert.ok(body.d.results[0].AmountInCompanyCodeCurrency);
});

test("returns a financial planning entry by ID", async () => {
	const response = await app.request(
		`http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem/FP-0001`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.equal(body.d.ID, "FP-0001");
	assert.ok(body.d.PlanningCategory);
});

test("returns a journal entry item by ID", async () => {
	const response = await app.request(
		`http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic/JE-0001`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.equal(body.d.ID, "JE-0001");
	assert.ok(body.d.BusinessTransactionCategory);
});

test("projects financial planning entries with OData select", async () => {
	const response = await app.request(
		`http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem?$top=1&$select=ID,CompanyCode`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.deepEqual(Object.keys(body.d.results[0]).sort(), [
		"CompanyCode",
		"ID",
		"__metadata",
	]);
});

test("filters financial planning entries by company code", async () => {
	const response = await app.request(
		`http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem?$filter=CompanyCode%20eq%20%271010%27`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.ok(body.d.results.length > 0);
	assert.ok(
		body.d.results.every(
			(item: { CompanyCode: string }) => item.CompanyCode === "1010",
		),
	);
});

test("filters journal entry items by company code", async () => {
	const response = await app.request(
		`http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic?$filter=CompanyCode%20eq%20%271010%27`,
	);

	assert.equal(response.status, 200);

	const body = await response.json();
	assert.ok(body.d.results.length > 0);
	assert.ok(
		body.d.results.every(
			(item: { CompanyCode: string }) => item.CompanyCode === "1010",
		),
	);
});

test("returns 404 for unknown financial planning entry ID", async () => {
	const response = await app.request(
		`http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem/FP-UNKNOWN`,
	);

	assert.equal(response.status, 404);
});

test("returns 404 for unknown journal entry item ID", async () => {
	const response = await app.request(
		`http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic/JE-UNKNOWN`,
	);

	assert.equal(response.status, 404);
});
