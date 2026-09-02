import { apiFinplanningentryitemSrv } from "./generated/API_FINPLANNINGENTRYITEM_SRV/index.ts";
import { apiJournalentryitembasicSrv } from "./generated/API_JOURNALENTRYITEMBASIC_SRV/index.ts";

const destination = {
	url: process.env.MOCK_SERVER_URL ?? "http://localhost:3141",
	authentication: "NoAuthentication" as const,
};

function usage(): never {
	console.error(
		"Usage: financial-client <planning|journal> <list|get> [id] [--company-code <code>]",
	);
	process.exit(1);
}

function companyCodeFrom(args: string[]): string | undefined {
	const index = args.indexOf("--company-code");
	if (index === -1) {
		return undefined;
	}

	return args[index + 1] || usage();
}

async function listPlanning(companyCode?: string) {
	const entries = await apiFinplanningentryitemSrv()
		.finPlanningEntryItemApi.requestBuilder()
		.getAll()
		.execute(destination);

	return companyCode
		? entries.filter((entry) => entry.companyCode === companyCode)
		: entries;
}

async function listJournal(companyCode?: string) {
	const entries = await apiJournalentryitembasicSrv()
		.journalEntryItemBasicApi.requestBuilder()
		.getAll()
		.execute(destination);

	return companyCode
		? entries.filter((entry) => entry.companyCode === companyCode)
		: entries;
}

const [service, operation, id, ...options] = process.argv.slice(2);
const companyCode = companyCodeFrom([id, ...options]);

if (
	!service ||
	!operation ||
	!["planning", "journal"].includes(service) ||
	!["list", "get"].includes(operation)
) {
	usage();
}

const entries =
	service === "planning"
		? await listPlanning(companyCode)
		: await listJournal(companyCode);

if (operation === "list") {
	console.log(JSON.stringify(entries, null, 2));
} else {
	const entry = entries.find((item) => item.id === id);
	if (!entry) {
		console.error(`No ${service} entry found for ID ${id}.`);
		process.exit(2);
	}
	console.log(JSON.stringify(entry, null, 2));
}
