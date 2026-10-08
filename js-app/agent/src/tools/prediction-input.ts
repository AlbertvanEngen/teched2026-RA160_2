import { isValidIdentifier } from '../db.ts';

export interface PredictionInput {
  tableName: string;
  outputTable: string;
  predictionWhere: string;
  contextWhere?: string;
}

function whereClauseError(where: string, label: string): string | null {
  if (!where.trim()) return `Error: ${label} must not be empty.`;
  if (/;|--|\/\*/.test(where)) {
    return `Error: ${label} must be a single SQL predicate (no semicolons or comments).`;
  }
  return null;
}

/**
 * Validates the shared input of the prediction tools and builds the SELECTs for
 * context rows (default: NOT predictionWhere) and prediction rows.
 * Returns an error message for invalid input.
 */
export function predictionQueries(
  input: PredictionInput,
): { contextSql: string; predictionSql: string } | string {
  for (const name of [input.tableName, input.outputTable]) {
    if (!isValidIdentifier(name)) {
      return `Error: '${name}' is not a valid table name.`;
    }
  }
  const contextWhere = input.contextWhere?.trim() || undefined;
  const error =
    whereClauseError(input.predictionWhere, 'predictionWhere') ??
    (contextWhere ? whereClauseError(contextWhere, 'contextWhere') : null);
  if (error) return error;

  const from = `SELECT * FROM ${input.tableName} WHERE`;
  return {
    contextSql: `${from} ${contextWhere ?? `NOT (${input.predictionWhere})`} ORDER BY ALL`,
    predictionSql: `${from} ${input.predictionWhere} ORDER BY ALL`,
  };
}
