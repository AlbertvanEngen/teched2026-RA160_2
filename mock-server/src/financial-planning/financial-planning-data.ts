const BASE_URL = 'https://{host}:{port}/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV';

function seededRng(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

const rng = seededRng(137);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const randAmount = (min: number, max: number) => (min + rng() * (max - min)).toFixed(2);

const LEDGERS = [
    { code: '0L', name: 'Leading Ledger' },
    { code: '2L', name: 'Extension Ledger' },
];
const CATEGORIES = ['BUDGET', 'FORECAST', 'ACTUAL', 'PLAN'];
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
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'];
const FISCAL_YEARS = ['2024', '2025', '2026', '2027'];
const FISCAL_PERIODS = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012'];

function generateEntries() {
    const entries = [];
    for (let i = 1; i <= 1000; i++) {
        const id = `FP-${String(i).padStart(4, '0')}`;
        const ledger = pick(LEDGERS);
        const gl = pick(GL_ACCOUNTS);
        const company = pick(COMPANIES);
        const cc = pick(COST_CENTERS);
        const pc = pick(PROFIT_CENTERS);
        const txCurrency = pick(CURRENCIES);
        const txAmount = randAmount(1000, 500000);
        const globalAmount = (parseFloat(txAmount) * (0.85 + rng() * 0.3)).toFixed(2);
        const fiscalYear = pick(FISCAL_YEARS);
        const fiscalPeriod = pick(FISCAL_PERIODS);

        entries.push({
            __metadata: {
                id: `${BASE_URL}/A_FinPlanningEntryItem('${id}')`,
                uri: `${BASE_URL}/A_FinPlanningEntryItem('${id}')`,
                type: 'API_FINPLANNINGENTRYITEM_SRV.A_FinPlanningEntryItemType'
            },
            ID: id,
            Ledger: ledger.code,
            LedgerName: ledger.name,
            PlanningCategory: pick(CATEGORIES),
            LedgerFiscalYear: fiscalYear,
            FiscalPeriod: fiscalPeriod,
            FiscalYearPeriod: `${fiscalYear}${fiscalPeriod}`,
            GLAccount: gl.code,
            GLAccountName: gl.name,
            CompanyCode: company.code,
            CompanyCodeName: company.name,
            CostCenter: cc.code,
            CostCenterName: cc.name,
            ProfitCenter: pc.code,
            ProfitCenterName: pc.name,
            TransactionCurrency: txCurrency,
            AmountInTransactionCurrency: txAmount,
            CompanyCodeCurrency: txCurrency,
            AmountInCompanyCodeCurrency: txAmount,
            GlobalCurrency: 'EUR',
            AmountInGlobalCurrency: globalAmount
        });
    }
    return entries;
}

export const financialPlanningEntries = generateEntries();
