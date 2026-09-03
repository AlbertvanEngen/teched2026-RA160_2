const BASE_URL =
	'https://{host}:{port}/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';

function seededRng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		return (s >>> 0) / 0xffffffff;
	};
}

const rng = seededRng(251);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const ACCOUNT_BASE_AMOUNTS: Record<string, number> = {
	'410000': 18_000,
	'420000': 7_000,
	'510000': 13_000,
	'610000': 8_000,
	'620000': 14_000,
	'630000': 5_000,
};
const EXPENSE_ACCOUNTS = new Set(['510000', '610000', '620000', '630000']);

function parametricAmount(
	accountCode: string,
	fiscalYear: string,
	fiscalPeriod: string,
	lineItemCount: number,
	multiplier: number,
) {
	const seasonality =
		1 +
		0.14 * Math.sin(((Number(fiscalPeriod) - 1) * Math.PI * 2) / 12) +
		0.06 * Math.cos(((Number(fiscalPeriod) - 1) * Math.PI * 4) / 12);
	const annualTrend = 1 + (Number(fiscalYear) - 2018) * 0.025;
	const variation = 0.9 + rng() * 0.2;
	return (
		(ACCOUNT_BASE_AMOUNTS[accountCode] *
			seasonality *
			annualTrend *
			variation *
			multiplier) /
		lineItemCount
	);
}

function semanticAmountMultiplier(
	companyCode: string,
	costCenter: string,
	accountCode: string,
	fiscalYear: string,
	fiscalPeriod: string,
) {
	const year = Number(fiscalYear);
	const period = Number(fiscalPeriod);

	if (
		companyCode === '1710' &&
		costCenter === 'B2000' &&
		fiscalYear >= '2021' &&
		fiscalYear <= '2027'
	) {
		if (accountCode === '410000' && [5, 6, 7].includes(period)) return 1.28;
		if (accountCode === '420000' && [5, 6, 7].includes(period)) return 1.18;
		if (accountCode === '610000' && period <= 2 && year % 2 === 0) return 1.34;
	}

	if (
		companyCode === '1010' &&
		costCenter === 'A1000' &&
		accountCode === '620000' &&
		[3, 4].includes(period)
	) {
		return 1.22;
	}

	if (
		companyCode === '4010' &&
		costCenter === 'E5000' &&
		accountCode === '610000' &&
		year >= 2023 &&
		[9, 10, 11].includes(period)
	) {
		return 1.31;
	}

	return 1;
}

const LEDGERS = [
	{ code: '0L', name: 'Leading Ledger' },
	{ code: '2L', name: 'Extension Ledger' },
];
const GL_ACCOUNTS = [
	{ code: '410000', name: 'Revenue' },
	{ code: '420000', name: 'Other Operating Income' },
	{ code: '510000', name: 'Cost of Goods Sold' },
	{ code: '610000', name: 'Operating Expenses' },
	{ code: '620000', name: 'Personnel Costs' },
	{ code: '630000', name: 'Depreciation' },
	{ code: '710000', name: 'Financial Income' },
	{ code: '720000', name: 'Financial Expenses' },
];
const COMPANIES = [
	{ code: '1010', name: 'Global Headquarters' },
	{ code: '1710', name: 'Regional Operations' },
	{ code: '2010', name: 'Asia Pacific Hub' },
	{ code: '3010', name: 'Americas Division' },
	{ code: '4010', name: 'EMEA Operations' },
];
const COST_CENTERS = [
	{ code: 'A1000', name: 'Corporate Finance' },
	{ code: 'B2000', name: 'Sales Operations' },
	{ code: 'C3000', name: 'IT Services' },
	{ code: 'D4000', name: 'Human Resources' },
	{ code: 'E5000', name: 'Research & Development' },
	{ code: 'F6000', name: 'Supply Chain' },
	{ code: 'G7000', name: 'Marketing' },
];
const PROFIT_CENTERS = [
	{ code: 'PC1000', name: 'Corporate Services' },
	{ code: 'PC2000', name: 'Commercial Services' },
	{ code: 'PC3000', name: 'Technology Services' },
	{ code: 'PC4000', name: 'Manufacturing' },
	{ code: 'PC5000', name: 'Distribution' },
];
const ENTITY_PROFILES = [
	{
		company: COMPANIES[0],
		costCenter: COST_CENTERS[0],
		profitCenter: PROFIT_CENTERS[0],
		currency: 'EUR',
		accounts: [GL_ACCOUNTS[3], GL_ACCOUNTS[4], GL_ACCOUNTS[5]],
		transactionTypes: ['SA', 'AB'],
	},
	{
		company: COMPANIES[1],
		costCenter: COST_CENTERS[1],
		profitCenter: PROFIT_CENTERS[1],
		currency: 'USD',
		accounts: [GL_ACCOUNTS[0], GL_ACCOUNTS[1], GL_ACCOUNTS[3]],
		transactionTypes: ['DR', 'DZ', 'RE'],
	},
	{
		company: COMPANIES[3],
		costCenter: COST_CENTERS[6],
		profitCenter: PROFIT_CENTERS[1],
		currency: 'USD',
		accounts: [GL_ACCOUNTS[0], GL_ACCOUNTS[1], GL_ACCOUNTS[3]],
		transactionTypes: ['DR', 'DZ', 'RE'],
	},
	{
		company: COMPANIES[4],
		costCenter: COST_CENTERS[4],
		profitCenter: PROFIT_CENTERS[2],
		currency: 'EUR',
		accounts: [GL_ACCOUNTS[3], GL_ACCOUNTS[4], GL_ACCOUNTS[5]],
		transactionTypes: ['SA', 'KR', 'KZ'],
	},
];
const FISCAL_YEARS = [
	'2018',
	'2019',
	'2020',
	'2021',
	'2022',
	'2023',
	'2024',
	'2025',
	'2026',
	'2027',
];
const FISCAL_PERIODS = [
	'001',
	'002',
	'003',
	'004',
	'005',
	'006',
	'007',
	'008',
	'009',
	'010',
	'011',
	'012',
];
const TX_CATEGORIES = ['RFBU', 'RMVL', 'COIN', 'PRFI'];

// Every profile/year/period/account combination gets several postings so no
// reporting period comes back empty.
function generateEntries() {
	const entries = [];
	let sequence = 0;

	for (const entity of ENTITY_PROFILES) {
		for (const fiscalYear of FISCAL_YEARS) {
			for (const fiscalPeriod of FISCAL_PERIODS) {
				for (const gl of entity.accounts) {
					const lineItemCount = 5 + Math.floor(rng() * 3);

					for (let item = 0; item < lineItemCount; item++) {
						sequence++;
						const id = `JE-${String(sequence).padStart(4, '0')}`;
						const ledger = pick(LEDGERS);
						const baseAmount = parametricAmount(
							gl.code,
							fiscalYear,
							fiscalPeriod,
							lineItemCount,
							semanticAmountMultiplier(
								entity.company.code,
								entity.costCenter.code,
								gl.code,
								fiscalYear,
								fiscalPeriod,
							),
						);
						const standardSign = EXPENSE_ACCOUNTS.has(gl.code) ? -1 : 1;
						const signedAmount =
							rng() < 0.04
								? -standardSign * baseAmount * 0.15
								: standardSign * baseAmount;
						const txAmount = signedAmount.toFixed(2);
						const globalAmount = (signedAmount * (0.97 + rng() * 0.06)).toFixed(
							2,
						);

						entries.push({
							__metadata: {
								id: `${BASE_URL}/A_JournalEntryItemBasic('${id}')`,
								uri: `${BASE_URL}/A_JournalEntryItemBasic('${id}')`,
								type: 'API_JOURNALENTRYITEMBASIC_SRV.A_JournalEntryItemBasicType',
							},
							ID: id,
							Ledger: ledger.code,
							LedgerName: ledger.name,
							SourceLedger: ledger.code,
							LedgerFiscalYear: fiscalYear,
							FiscalPeriod: fiscalPeriod,
							FiscalYearPeriod: `${fiscalYear}${fiscalPeriod}`,
							CompanyCode: entity.company.code,
							CompanyCodeName: entity.company.name,
							GLAccount: gl.code,
							GLAccountName: gl.name,
							BusinessTransactionCategory: pick(TX_CATEGORIES),
							BusinessTransactionType: pick(entity.transactionTypes),
							CostCenter: entity.costCenter.code,
							CostCenterName: entity.costCenter.name,
							ProfitCenter: entity.profitCenter.code,
							ProfitCenterName: entity.profitCenter.name,
							TransactionCurrency: entity.currency,
							AmountInTransactionCurrency: txAmount,
							CompanyCodeCurrency: entity.currency,
							AmountInCompanyCodeCurrency: txAmount,
							GlobalCurrency: 'EUR',
							AmountInGlobalCurrency: globalAmount,
						});
					}
				}
			}
		}
	}

	return entries;
}

let journalEntryItems: ReturnType<typeof generateEntries> | undefined;

export function getJournalEntryItems() {
	journalEntryItems ??= generateEntries();
	return journalEntryItems;
}
