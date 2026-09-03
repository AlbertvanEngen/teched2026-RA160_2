import { runQuery } from './db.ts';

// Tables produced by RPT — trend SQL is fine on these.
const predictionTables = new Set<string>();

export function registerPredictionTable(name: string) {
	predictionTables.add(name.toLowerCase());
}

export function isValidIdentifier(name: string) {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

// Descriptive reporting (GROUP BY, SUM/AVG/COUNT/MIN/MAX) stays allowed — only the
// constructs used to extrapolate future values from history are blocked.
const FORECASTING_PATTERN =
	/\bover\s*\(|\bqualify\b|\b(?:lag|lead|ntile|row_number|rank|dense_rank|first_value|last_value|nth_value|cume_dist|percent_rank)\s*\(|\b(?:regr_\w+|corr|covar_\w+|stddev\w*|variance|var_pop|var_samp|entropy)\s*\(/i;

/**
 * Forecasts must come from RPT, not from hand-rolled trend SQL: window/lag
 * arithmetic, moving averages and regression aggregates over source data are rejected.
 */
export async function assertNoForecastingSql(
	sql: string,
): Promise<string | null> {
	if (!FORECASTING_PATTERN.test(sql)) return null;

	const catalog = await runQuery(
		'SELECT table_name FROM information_schema.tables',
	);
	const sourceTables = catalog
		.map((r) => String(r.table_name))
		.filter(
			(name) =>
				!predictionTables.has(name.toLowerCase()) &&
				new RegExp(`\\b${name}\\b`, 'i').test(sql),
		);
	if (sourceTables.length === 0) return null;

	return (
		`Error: trend SQL (window functions, OVER/QUALIFY, LAG/LEAD, moving averages, REGR_*/CORR/STDDEV) is not ` +
		`available on source tables: ${sourceTables.join(', ')}. Extrapolating by hand would just be a guess — ` +
		`run run_rpt_prediction_from_sources to get real predictions, then aggregate its output table. ` +
		`Ordinary reporting on source tables (SELECT, WHERE, JOIN, GROUP BY, SUM/AVG/COUNT/MIN/MAX) still works.`
	);
}
