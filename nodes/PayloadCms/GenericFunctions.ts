import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export interface IPayloadCredentials {
	baseUrl: string;
	apiRoute?: string;
	authCollection: string;
	authenticationType: 'apiKey' | 'jwt';
	apiKey?: string;
	email?: string;
	password?: string;
}

export interface IWhereFilterCondition {
	field: string;
	operator: string;
	value: string;
}

export interface IPayloadPaginatedResponse {
	docs: IDataObject[];
	totalDocs: number;
	limit: number;
	totalPages: number;
	page: number;
	pagingCounter?: number;
	hasPrevPage: boolean;
	hasNextPage: boolean;
	prevPage: number | null;
	nextPage: number | null;
}

interface ICachedJwt {
	token: string;
	exp: number; // Unix timestamp in seconds
}

type PayloadContext = IExecuteFunctions | IPollFunctions | ILoadOptionsFunctions;

const jwtCache = new Map<string, ICachedJwt>();

/**
 * Clears the in-memory JWT cache (primarily useful for tests or after explicit logout).
 */
export function clearJwtCache(cacheKey?: string): void {
	if (cacheKey) {
		jwtCache.delete(cacheKey);
	} else {
		jwtCache.clear();
	}
}

/**
 * Builds the normalized Payload CMS REST API base URL without a trailing slash.
 * Prevents accidentally duplicating `/api` if the user already appended it to Base URL.
 */
export function buildApiBaseUrl(credentials: IPayloadCredentials): string {
	const rawBase = (credentials.baseUrl || '').trim().replace(/\/+$/, '');
	let route = (credentials.apiRoute ?? '/api').trim();

	if (route && !route.startsWith('/')) {
		route = `/${route}`;
	}
	route = route.replace(/\/+$/, '');

	if (!route) {
		return rawBase;
	}

	if (rawBase.toLowerCase().endsWith(route.toLowerCase())) {
		return rawBase;
	}

	return `${rawBase}${route}`;
}

/**
 * Builds the origin URL (base without API route) for resolving relative media file URLs.
 */
export function buildOriginUrl(credentials: IPayloadCredentials): string {
	const rawBase = (credentials.baseUrl || '').trim().replace(/\/+$/, '');
	const route = (credentials.apiRoute ?? '/api').trim().replace(/\/+$/, '');
	const normalizedRoute = route && !route.startsWith('/') ? `/${route}` : route;

	if (normalizedRoute && rawBase.toLowerCase().endsWith(normalizedRoute.toLowerCase())) {
		return rawBase.slice(0, -normalizedRoute.length);
	}

	return rawBase;
}

/**
 * Recursively serializes an object into a Payload/qs-compatible bracket-notation query string.
 * Preserves booleans (`false`) and numbers (`0`), while omitting `undefined` and empty strings.
 */
export function serializeQueryParams(params: IDataObject): string {
	const pairs: string[] = [];

	const encodeEntry = (prefix: string, value: unknown): void => {
		if (value === undefined || value === null) {
			return;
		}

		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				encodeEntry(`${prefix}[${index}]`, item);
			});
			return;
		}

		if (typeof value === 'object') {
			const obj = value as IDataObject;
			for (const [key, nestedValue] of Object.entries(obj)) {
				encodeEntry(prefix ? `${prefix}[${key}]` : key, nestedValue);
			}
			return;
		}

		pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
	};

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') {
			continue;
		}
		encodeEntry(key, value);
	}

	return pairs.join('&');
}

/**
 * Converts a Payload v3 `select` string (e.g. `title,slug,group.field,-secret` or raw JSON)
 * into Payload's nested `select` object format (`select[title]=true`).
 */
export function parseSelectFields(selectInput: string): IDataObject | undefined {
	const trimmed = selectInput.trim();
	if (!trimmed) {
		return undefined;
	}

	if (trimmed.startsWith('{')) {
		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as IDataObject;
			}
		} catch {
			// Fall through to comma-separated parsing if not valid JSON
		}
	}

	const selectObj: IDataObject = {};
	const fields = trimmed
		.split(',')
		.map((f) => f.trim())
		.filter(Boolean);

	for (const rawField of fields) {
		const isExclusion = rawField.startsWith('-');
		const fieldPath = isExclusion ? rawField.slice(1).trim() : rawField;
		if (!fieldPath) {
			continue;
		}

		const segments = fieldPath.split('.').filter(Boolean);
		let cursor = selectObj;
		for (let idx = 0; idx < segments.length; idx++) {
			const segment = segments[idx];
			if (idx === segments.length - 1) {
				cursor[segment] = !isExclusion;
			} else {
				if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
					cursor[segment] = {};
				}
				cursor = cursor[segment] as IDataObject;
			}
		}
	}

	return Object.keys(selectObj).length > 0 ? selectObj : undefined;
}

/**
 * Builds a Payload CMS `where` query object from UI filter conditions.
 */
export function buildWhereFromFilters(
	conditions: IWhereFilterCondition[],
	combinator: 'and' | 'or' = 'and',
): IDataObject | undefined {
	const clauses: IDataObject[] = [];

	for (const condition of conditions) {
		const field = (condition.field || '').trim();
		const operator = condition.operator || 'equals';
		if (!field) {
			continue;
		}

		let parsedValue: unknown = condition.value;

		if (operator === 'exists') {
			const normalized = String(condition.value).trim().toLowerCase();
			parsedValue = normalized !== 'false' && normalized !== '0' && normalized !== '';
		} else if (operator === 'in' || operator === 'not_in' || operator === 'all') {
			parsedValue = String(condition.value)
				.split(',')
				.map((v) => v.trim())
				.filter((v) => v.length > 0);
		} else if (operator === 'within' || operator === 'intersects') {
			try {
				parsedValue = JSON.parse(condition.value);
			} catch {
				parsedValue = condition.value;
			}
		}

		clauses.push({
			[field]: {
				[operator]: parsedValue,
			},
		});
	}

	if (clauses.length === 0) {
		return undefined;
	}

	if (clauses.length === 1 && combinator === 'and') {
		return clauses[0];
	}

	return {
		[combinator]: clauses,
	};
}

/**
 * Parses a JSON string or already-parsed object parameter into an IDataObject.
 */
export function parseJsonObject(
	context: PayloadContext,
	value: unknown,
	paramName: string,
	itemIndex = 0,
): IDataObject {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		return value as IDataObject;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return {};
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed) as unknown;
		} catch (error) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid JSON in parameter "${paramName}": ${(error as Error).message}`,
				{ itemIndex },
			);
		}
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			throw new NodeOperationError(
				context.getNode(),
				`Parameter "${paramName}" must be a JSON object`,
				{ itemIndex },
			);
		}
		return parsed as IDataObject;
	}

	throw new NodeOperationError(
		context.getNode(),
		`Parameter "${paramName}" must be a valid JSON object`,
		{ itemIndex },
	);
}

/**
 * Extracts document body data from either JSON or Fields UI mode.
 */
export function getDocumentBodyFromParameters(
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject {
	const dataInputMode = context.getNodeParameter('dataInputMode', itemIndex, 'json') as string;

	if (dataInputMode === 'json') {
		const bodyJson = context.getNodeParameter('bodyJson', itemIndex);
		return parseJsonObject(context, bodyJson, 'Document Data', itemIndex);
	}

	const fieldsUi = context.getNodeParameter('fieldsUi', itemIndex, {}) as {
		fieldValues?: Array<{
			fieldName: string;
			fieldValue: string;
			parseJson?: boolean;
		}>;
	};

	const body: IDataObject = {};
	for (const entry of fieldsUi.fieldValues ?? []) {
		const key = (entry.fieldName || '').trim();
		if (!key) {
			continue;
		}
		if (entry.parseJson) {
			try {
				body[key] = JSON.parse(entry.fieldValue);
			} catch (error) {
				throw new NodeOperationError(
					context.getNode(),
					`Failed to parse JSON value for field "${key}": ${(error as Error).message}`,
					{ itemIndex },
				);
			}
		} else {
			body[key] = entry.fieldValue;
		}
	}

	return body;
}

/**
 * Extracts the `where` query object from Filter Builder or JSON Where Query parameters.
 */
export function getWhereFromParameters(
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject | undefined {
	const filterMode = context.getNodeParameter('filterMode', itemIndex, 'none') as string;

	if (filterMode === 'none') {
		return undefined;
	}

	if (filterMode === 'json') {
		const whereJson = context.getNodeParameter('whereJson', itemIndex);
		const parsed = parseJsonObject(context, whereJson, 'Where Query (JSON)', itemIndex);
		return Object.keys(parsed).length > 0 ? parsed : undefined;
	}

	const combinator = context.getNodeParameter('filterCombinator', itemIndex, 'and') as 'and' | 'or';
	const filters = context.getNodeParameter('filters', itemIndex, {}) as {
		conditions?: IWhereFilterCondition[];
	};

	return buildWhereFromFilters(filters.conditions ?? [], combinator);
}

/**
 * Maps standard Payload option parameters (`depth`, `locale`, `fallbackLocale`, `draft`, `select`, `sort`, `page`, `autosave`)
 * into a Payload REST API query object.
 */
export function applyPayloadOptionsToQuery(qs: IDataObject, options: IDataObject): void {
	if (options.depth !== undefined && options.depth !== '') {
		qs.depth = options.depth;
	}
	if (options.draft !== undefined) {
		qs.draft = options.draft;
	}
	if (typeof options.locale === 'string' && options.locale.trim() !== '') {
		qs.locale = options.locale.trim();
	}
	if (typeof options.fallbackLocale === 'string' && options.fallbackLocale.trim() !== '') {
		qs['fallback-locale'] = options.fallbackLocale.trim();
	}
	if (typeof options.select === 'string' && options.select.trim() !== '') {
		const parsedSelect = parseSelectFields(options.select);
		if (parsedSelect) {
			qs.select = parsedSelect;
		}
	}
	if (typeof options.sort === 'string' && options.sort.trim() !== '') {
		qs.sort = options.sort.trim();
	}
	if (options.page !== undefined && options.page !== '') {
		qs.page = options.page;
	}
	if (options.autosave === true) {
		qs.autosave = true;
	}
}

function getJwtCacheKey(credentials: IPayloadCredentials): string {
	return [
		buildApiBaseUrl(credentials),
		credentials.authCollection || 'users',
		credentials.email || '',
	].join('|');
}

/**
 * Loads the active Payload CMS credential based on the node's `authentication` selector.
 */
export async function getPayloadCredentials(
	context: PayloadContext,
	itemIndex = 0,
): Promise<IPayloadCredentials> {
	const authentication = (
		'getInputData' in context
			? context.getNodeParameter('authentication', itemIndex, 'apiKey')
			: context.getNodeParameter('authentication', 'apiKey')
	) as 'apiKey' | 'jwt';

	const credName = authentication === 'jwt' ? 'payloadCmsJwtApi' : 'payloadCmsApi';
	const raw = (await context.getCredentials(credName)) as unknown as Omit<
		IPayloadCredentials,
		'authenticationType'
	>;

	return {
		...raw,
		authenticationType: authentication,
	};
}

/**
 * Resolves the `Authorization` header for either API Key or Email/Password (JWT) credentials.
 * Caches JWT tokens in memory until 60 seconds before expiry.
 */
export async function getAuthorizationHeader(
	context: PayloadContext,
	credentials: IPayloadCredentials,
	forceRefresh = false,
): Promise<string> {
	const authCollection = (credentials.authCollection || 'users').trim();

	if (credentials.authenticationType === 'apiKey') {
		if (!credentials.apiKey) {
			throw new NodeOperationError(context.getNode(), 'Payload CMS API Key is missing in credentials');
		}
		return `${authCollection} API-Key ${credentials.apiKey}`;
	}

	const cacheKey = getJwtCacheKey(credentials);
	const nowSeconds = Math.floor(Date.now() / 1000);

	if (!forceRefresh) {
		const cached = jwtCache.get(cacheKey);
		if (cached && cached.exp > nowSeconds + 60) {
			return `JWT ${cached.token}`;
		}
	}

	const apiBase = buildApiBaseUrl(credentials);
	const loginResponse = (await context.helpers.httpRequest({
		method: 'POST',
		url: `${apiBase}/${encodeURIComponent(authCollection)}/login`,
		body: {
			email: credentials.email,
			password: credentials.password,
		},
		json: true,
	})) as { token?: string; exp?: number };

	if (!loginResponse?.token) {
		throw new NodeOperationError(
			context.getNode(),
			'Payload CMS login succeeded without returning a JWT token',
		);
	}

	jwtCache.set(cacheKey, {
		token: loginResponse.token,
		exp: loginResponse.exp ?? nowSeconds + 3600,
	});

	return `JWT ${loginResponse.token}`;
}

export interface IPayloadRequestOptions {
	skipAuth?: boolean;
	headers?: IDataObject;
	rawBody?: unknown;
	encoding?: 'arraybuffer' | 'blob' | 'json' | 'stream' | 'text';
	returnFullResponse?: boolean;
}

/**
 * Executes an authenticated HTTP request against the Payload CMS REST API.
 * Automatically serializes nested `where` / `select` query parameters and retries once
 * with a refreshed JWT on HTTP 401 when using Email & Password authentication.
 */
export async function payloadApiRequest(
	this: PayloadContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs: IDataObject = {},
	extra: IPayloadRequestOptions = {},
): Promise<unknown> {
	const credentials = await getPayloadCredentials(this);
	const apiBase = buildApiBaseUrl(credentials);
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	const queryString = serializeQueryParams(qs);
	const url = `${apiBase}${normalizedEndpoint}${queryString ? `?${queryString}` : ''}`;

	const executeRequest = async (forceRefreshJwt: boolean): Promise<unknown> => {
		const headers: IDataObject = {
			...(extra.headers ?? {}),
		};

		const requestOptions: IHttpRequestOptions = {
			method,
			url,
			headers,
			returnFullResponse: extra.returnFullResponse,
		};

		if (extra.rawBody !== undefined) {
			requestOptions.body = extra.rawBody;
		} else if (body !== undefined && Object.keys(body).length > 0) {
			requestOptions.body = body;
			requestOptions.json = true;
		} else if (extra.encoding) {
			requestOptions.encoding = extra.encoding;
		} else {
			requestOptions.json = true;
		}

		if (extra.skipAuth) {
			return this.helpers.httpRequest(requestOptions);
		}

		if (credentials.authenticationType === 'apiKey') {
			return this.helpers.httpRequestWithAuthentication.call(
				this,
				'payloadCmsApi',
				requestOptions,
			);
		}

		headers.Authorization = await getAuthorizationHeader(this, credentials, forceRefreshJwt);
		return this.helpers.httpRequest(requestOptions);
	};

	try {
		return await executeRequest(false);
	} catch (error) {
		const statusCode =
			(error as { statusCode?: number; httpCode?: string; response?: { status?: number } })
				?.statusCode ??
			(error as { response?: { status?: number } })?.response?.status ??
			Number((error as { httpCode?: string })?.httpCode);

		if (statusCode === 401 && !extra.skipAuth && credentials.authenticationType === 'jwt') {
			try {
				return await executeRequest(true);
			} catch (retryError) {
				throw new NodeApiError(this.getNode(), retryError as JsonObject);
			}
		}

		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Fetches all matching documents across pages from a Payload CMS collection endpoint.
 */
export async function payloadApiRequestAllItems(
	this: PayloadContext,
	endpoint: string,
	qs: IDataObject = {},
	maxItems?: number,
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	const pageSize = maxItems ? Math.min(maxItems, 100) : 100;
	let page = 1;
	let hasNextPage = true;

	while (hasNextPage) {
		const response = (await payloadApiRequest.call(this, 'GET', endpoint, undefined, {
			...qs,
			limit: pageSize,
			page,
		})) as IPayloadPaginatedResponse;

		const docs = Array.isArray(response?.docs) ? response.docs : [];
		returnData.push(...docs);

		if (maxItems && returnData.length >= maxItems) {
			return returnData.slice(0, maxItems);
		}

		hasNextPage = Boolean(response?.hasNextPage && response?.nextPage);
		page = response?.nextPage ?? page + 1;

		if (docs.length === 0) {
			break;
		}
	}

	return returnData;
}

/**
 * Downloads a media file from Payload CMS (handling relative or absolute URLs and both API Key & JWT auth).
 */
export async function payloadDownloadMediaFile(
	this: PayloadContext,
	fileUrl: string,
): Promise<Buffer> {
	const credentials = await getPayloadCredentials(this);
	const originUrl = buildOriginUrl(credentials);
	const resolvedUrl = /^https?:\/\//i.test(fileUrl)
		? fileUrl
		: `${originUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;

	const executeDownload = async (forceRefreshJwt: boolean): Promise<Buffer> => {
		const requestOptions: IHttpRequestOptions = {
			method: 'GET',
			url: resolvedUrl,
			encoding: 'arraybuffer',
		};

		let responseBuffer: ArrayBuffer | Uint8Array | Buffer;
		if (credentials.authenticationType === 'apiKey') {
			responseBuffer = (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'payloadCmsApi',
				requestOptions,
			)) as ArrayBuffer | Uint8Array | Buffer;
		} else {
			requestOptions.headers = {
				Authorization: await getAuthorizationHeader(this, credentials, forceRefreshJwt),
			};
			responseBuffer = (await this.helpers.httpRequest(requestOptions)) as
				| ArrayBuffer
				| Uint8Array
				| Buffer;
		}

		return Buffer.isBuffer(responseBuffer)
			? responseBuffer
			: Buffer.from(new Uint8Array(responseBuffer));
	};

	try {
		return await executeDownload(false);
	} catch (error) {
		const statusCode =
			(error as { statusCode?: number; httpCode?: string; response?: { status?: number } })
				?.statusCode ??
			(error as { response?: { status?: number } })?.response?.status ??
			Number((error as { httpCode?: string })?.httpCode);

		if (statusCode === 401 && credentials.authenticationType === 'jwt') {
			try {
				return await executeDownload(true);
			} catch (retryError) {
				throw new NodeApiError(this.getNode(), retryError as JsonObject);
			}
		}

		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
