import type { Context } from 'hono';

type ODataRecord = Record<string, unknown>;

type ComparisonOperator = 'eq' | 'ne' | 'lt' | 'gt' | 'le' | 'ge';

function isRecord(value: unknown): value is ODataRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNavigationProperty(propertyName: string): boolean {
	return propertyName.startsWith('to_');
}

function getNestedValue(record: ODataRecord, propertyPath: string): unknown {
	return propertyPath.split('/').reduce<unknown>((current, property) => {
		return isRecord(current) ? current[property] : undefined;
	}, record);
}

function normalizeComparisonValue(propertyName: string, value: string): string {
	const unquotedValue = value
		.replace(/^'(.*)'$/, '$1')
		.replace(/^datetime'(.*)'$/, '$1');

	if (!propertyName.includes('Date') || unquotedValue.startsWith('/Date(')) {
		return unquotedValue;
	}

	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(unquotedValue);
	if (!dateMatch) {
		return unquotedValue;
	}

	const [, year, month, day] = dateMatch;
	return `/Date(${Date.UTC(Number(year), Number(month) - 1, Number(day))})/`;
}

function compareValues(
	actual: unknown,
	operator: ComparisonOperator,
	expected: string,
): boolean {
	const value = typeof actual === 'string' ? actual : String(actual);

	switch (operator) {
		case 'eq':
			return value === expected;
		case 'ne':
			return value !== expected;
		case 'lt':
			return value < expected;
		case 'gt':
			return value > expected;
		case 'le':
			return value <= expected;
		case 'ge':
			return value >= expected;
	}
}

function applyNavigationFilter<T extends ODataRecord>(
	result: T[],
	filter: string,
): T[] {
	const match = /^(.+?)\/any\((\w+):\((.+?)\)\)$/.exec(filter);
	if (!match) {
		return result;
	}

	const [, navigationPath, alias, condition] = match;
	const conditionMatch = new RegExp(
		`^${alias}\\/(.+?)\\s+(lt|gt|le|ge|eq|ne)\\s+(.+)$`,
	).exec(condition);
	if (!conditionMatch) {
		return result;
	}

	const [, propertyPath, operator, rawValue] = conditionMatch;
	const segments = navigationPath.split('/').map((segment) => {
		if (segment === '_PurchaseOrderScheduleLineTP') {
			return 'to_ScheduleLine';
		}

		return segment.startsWith('_') ? `to${segment}` : segment;
	});

	return result.filter((item) => {
		let current: unknown = item;

		for (const segment of segments) {
			if (!isRecord(current)) {
				return false;
			}

			const next = current[segment];
			current =
				isRecord(next) && Array.isArray(next.results) ? next.results : next;
		}

		if (!Array.isArray(current)) {
			return false;
		}

		return current.some((candidate) => {
			if (!isRecord(candidate)) {
				return false;
			}

			const actual = getNestedValue(candidate, propertyPath);
			const expected = normalizeComparisonValue(propertyPath, rawValue);
			return (
				actual !== undefined &&
				compareValues(actual, operator as ComparisonOperator, expected)
			);
		});
	});
}

function applyFilter<T extends ODataRecord>(result: T[], filter: string): T[] {
	if (filter.includes('/any(')) {
		return applyNavigationFilter(result, filter);
	}

	const match = /^\(?([\w/]+)\s+(eq|ne|lt|gt|le|ge)\s+(.+?)\)?$/.exec(filter);
	if (!match) {
		return result;
	}

	const [, propertyPath, operator, rawValue] = match;
	const expected = normalizeComparisonValue(propertyPath, rawValue);

	return result.filter((item) => {
		const actual = getNestedValue(item, propertyPath);
		return (
			actual !== undefined &&
			compareValues(actual, operator as ComparisonOperator, expected)
		);
	});
}

function expandEntity(
	entity: ODataRecord,
	expandedProperties: string[],
): ODataRecord {
	return Object.entries(entity).reduce<ODataRecord>((result, [key, value]) => {
		if (!isNavigationProperty(key)) {
			result[key] = value;
			return result;
		}

		const childProperties = expandedProperties
			.filter((property) => property === key || property.startsWith(`${key}/`))
			.map((property) => property.slice(key.length + 1))
			.filter(Boolean);

		if (expandedProperties.includes(key) || childProperties.length > 0) {
			if (isRecord(value) && Array.isArray(value.results)) {
				result[key] = {
					results: value.results
						.filter(isRecord)
						.map((child) => expandEntity(child, childProperties)),
				};
			} else {
				result[key] = value;
			}

			return result;
		}

		const metadata = entity.__metadata;
		const uri =
			isRecord(metadata) && typeof metadata.uri === 'string'
				? metadata.uri
				: undefined;
		result[key] = uri ? { __deferred: { uri: `${uri}/${key}` } } : value;
		return result;
	}, {});
}

function selectEntity(
	entity: ODataRecord,
	selectedProperties: string[],
): ODataRecord {
	return Object.entries(entity).reduce<ODataRecord>((result, [key, value]) => {
		const childProperties = selectedProperties
			.filter((property) => property.startsWith(`${key}/`))
			.map((property) => property.slice(key.length + 1));

		if (
			key === '__metadata' ||
			selectedProperties.includes(key) ||
			(selectedProperties.includes('*') && !isNavigationProperty(key))
		) {
			result[key] = value;
		} else if (
			isNavigationProperty(key) &&
			childProperties.length > 0 &&
			isRecord(value) &&
			Array.isArray(value.results)
		) {
			result[key] = {
				results: value.results
					.filter(isRecord)
					.map((child) => selectEntity(child, childProperties)),
			};
		}

		return result;
	}, {});
}

export function toODataResponse(
	context: Context,
	result: unknown,
	status: 200 | 201 = 200,
	headers: Record<string, string> = {},
) {
	const arrayWrapped = Array.isArray(result) ? { results: result } : result;
	const origin = new URL(context.req.url).origin;
	const body = JSON.stringify({ d: arrayWrapped }).replace(
		/https:\/\/\{host\}:\{port\}/g,
		origin,
	);

	return context.body(body, status, {
		'Content-Type': 'application/json',
		...headers,
	});
}

export function filterODataResult<T extends ODataRecord>(
	result: T[],
	filterQuery?: string,
): T[] {
	if (!filterQuery) {
		return result;
	}

	const normalizedQuery =
		filterQuery.startsWith('(') && filterQuery.endsWith(')')
			? filterQuery.slice(1, -1)
			: filterQuery;

	return normalizedQuery
		.split('and')
		.reduce(
			(filteredResult, singleFilter) =>
				applyFilter(filteredResult, singleFilter.trim()),
			result,
		);
}

export function expandODataResult<T extends ODataRecord>(
	result: T[],
	expandQuery?: string,
): ODataRecord[];
export function expandODataResult<T extends ODataRecord>(
	result: T,
	expandQuery?: string,
): ODataRecord;
export function expandODataResult(
	result: ODataRecord[] | ODataRecord,
	expandQuery?: string,
): ODataRecord[] | ODataRecord {
	const expandedProperties = expandQuery ? expandQuery.split(',') : [];

	return Array.isArray(result)
		? result.map((entity) => expandEntity(entity, expandedProperties))
		: expandEntity(result, expandedProperties);
}

export function selectODataResult<T extends ODataRecord>(
	result: T[],
	selectQuery?: string,
): ODataRecord[];
export function selectODataResult<T extends ODataRecord>(
	result: T,
	selectQuery?: string,
): ODataRecord;
export function selectODataResult(
	result: ODataRecord[] | ODataRecord,
	selectQuery?: string,
): ODataRecord[] | ODataRecord {
	if (!selectQuery) {
		return result;
	}

	const selectedProperties = selectQuery.split(',');
	return Array.isArray(result)
		? result.map((entity) => selectEntity(entity, selectedProperties))
		: selectEntity(result, selectedProperties);
}

export function topODataResult<T>(result: T[], topQuery?: string): T[] {
	const top = Number.parseInt(topQuery ?? '', 10);
	return Number.isNaN(top) ? result : result.slice(0, top);
}

export function sortODataResult<T extends ODataRecord>(
	result: T[],
	orderbyQuery?: string,
): T[] {
	if (!orderbyQuery) {
		return result;
	}

	const [property, direction] = orderbyQuery.split(' ');
	if (!property) {
		return result;
	}

	const multiplier = direction === 'desc' ? -1 : 1;
	return [...result].sort((left, right) => {
		const leftValue = left[property];
		const rightValue = right[property];

		if (leftValue === undefined || rightValue === undefined) {
			return 0;
		}

		const leftString = String(leftValue);
		const rightString = String(rightValue);

		if (leftString === rightString) {
			return 0;
		}

		return (leftString < rightString ? -1 : 1) * multiplier;
	});
}
